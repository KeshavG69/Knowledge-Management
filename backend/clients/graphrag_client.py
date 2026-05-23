"""
FalkorDB graph client — owns ingestion and retrieval.

Ingestion pipeline (called per document):
  1. Chunk text via Chonkie (SemanticChunker)
  2. Embed + LLM-extract entities/triples per chunk (parallel)
  3. Resolve entity names via normalize + cosine similarity (Option B)
  4. Bulk-write to FalkorDB: Chunk → MENTIONS → Entity → RELATES → Entity
  5. Stamp document_id on every chunk at write time (no provenance workaround needed)

Retrieval pipeline (4 phases, pre-filtered by document_id):
  1. Embed query
  2. MATCH chunks WHERE document_id IN $docs + vec.cosineDistance → top K
  3. Entity expansion via MENTIONS (same doc filter)
  4. RELATES triples from chunk set (confidence >= threshold)

Dynamic ontology (per org, in-memory, merged per doc):
  - First doc: LLM proposes entity types + relation types from sample text
  - Each subsequent doc: LLM proposes for that doc, merged into org's running schema
  - Shapes the extraction prompt so entities stay consistent across docs in the org
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from openai import AsyncOpenAI
import pydantic

from app.logger import logger
from app.settings import settings
from clients.chunker_client import get_chunker_client

try:
    import falkordb
except ImportError:  # pragma: no cover
    falkordb = None  # type: ignore


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _graph_name(organization_id: str) -> str:
    return f"org_{organization_id}"


def _norm(s: str) -> str:
    return s.strip().lower()


def _chunk_id(document_id: str, idx: int) -> str:
    return f"{document_id}#{idx}"


def _triple_id(subj: str, pred: str, obj: str, chunk_id: str) -> str:
    return hashlib.sha1(f"{subj}|{pred}|{obj}|{chunk_id}".encode()).hexdigest()[:16]


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        if text.endswith("```"):
            text = text[:-3].strip()
    return text


# ---------------------------------------------------------------------------
# Extraction schemas
# ---------------------------------------------------------------------------

class ExtractedEntity(pydantic.BaseModel):
    name: str
    type: str


class ExtractedTriple(pydantic.BaseModel):
    subject: str
    predicate: str
    object: str
    confidence: float = pydantic.Field(ge=0.0, le=1.0)


class Extraction(pydantic.BaseModel):
    entities: List[ExtractedEntity] = pydantic.Field(default_factory=list)
    triples: List[ExtractedTriple] = pydantic.Field(default_factory=list)


# ---------------------------------------------------------------------------
# Ontology prompts
# ---------------------------------------------------------------------------

_ONTOLOGY_PROMPT = """\
You are designing a knowledge-graph ontology for a corpus.

Read the SAMPLE TEXT and propose a compact ontology that captures the kinds of
things and relationships present. Aim for 6–12 entity types and 6–14 relation
types.

Rules:
- Entity labels: PascalCase, singular, no spaces, length >= 3.
- Relation labels: SCREAMING_SNAKE_CASE, verb phrase, length >= 3.
- Every relation MUST list at least one (source_label, target_label) pair from
  your entity labels.
- No duplicates.

Return ONLY valid JSON — no prose, no fences:
{{"entities": [{{"label": "...", "description": "..."}}, ...],
  "relations": [{{"label": "...", "description": "...",
                  "patterns": [["SrcLabel", "TgtLabel"], ...]}}, ...]}}

SAMPLE TEXT:
\"\"\"{sample}\"\"\"
"""


def _build_extract_prompt(entity_types: List[str], relation_types: List[str]) -> str:
    ent_list = ", ".join(entity_types) if entity_types else "Person, Organization, Product, Concept, Event, Location, Date"
    rel_list = ", ".join(relation_types) if relation_types else "FOUNDED, WORKS_FOR, LOCATED_IN, RELATED_TO, IS_A"
    return f"""\
You build a knowledge graph from a text passage.

PRECISION OVER RECALL. A small number of high-quality triples beats a long list of vague ones.

# Entity types for this corpus
{ent_list}

# Step 1 — Entities
Extract SPECIFIC named entities from the passage. Each entity must be a proper noun
or precise technical identifier. Reject generic nouns like "tool", "system", "user".
Assign one type from the list above (use the closest match).

# Step 2 — Triples
A triple records a CONCRETE FACT stated in this passage between two entities from Step 1.
- predicate: SCREAMING_SNAKE_CASE active verb from: {rel_list}
- confidence: 0.7–1.0 only (omit anything below 0.7)
- subject and object MUST exactly match entity names from Step 1

Return ONLY valid JSON:
{{"entities": [{{"name": "...", "type": "..."}}],
  "triples": [{{"subject": "...", "predicate": "...", "object": "...", "confidence": 0.9}}]}}
"""


# ---------------------------------------------------------------------------
# OpenAI async client (embeddings + LLM)
# ---------------------------------------------------------------------------

def _openai_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


def _openrouter_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
    )


async def _embed_texts(texts: List[str]) -> List[List[float]]:
    client = _openai_client()
    resp = await client.embeddings.create(
        model=settings.EMBEDDING_MODEL,
        input=texts,
    )
    return [item.embedding for item in resp.data]


async def _llm_json(prompt: str, model: str) -> str:
    client = _openrouter_client()
    resp = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=4096,
    )
    return resp.choices[0].message.content or ""


# ---------------------------------------------------------------------------
# Entity resolution (Option B: normalize + cosine similarity)
# ---------------------------------------------------------------------------

def _cosine_distance(a: List[float], b: List[float]) -> float:
    va, vb = np.array(a, dtype=np.float32), np.array(b, dtype=np.float32)
    na, nb = np.linalg.norm(va), np.linalg.norm(vb)
    if na == 0 or nb == 0:
        return 1.0
    return float(1.0 - np.dot(va, vb) / (na * nb))


async def _resolve_entities(
    names: List[str],
    threshold: float,
) -> Dict[str, str]:
    """Return mapping raw_name → canonical_name.

    Steps:
      1. Normalize (lowercase + strip) — exact dupes merged immediately.
      2. Embed unique normalized names in one batch call.
      3. Greedy merge: for each name (alphabetical), if any already-chosen
         canonical is within `threshold` cosine distance, map to that canonical;
         otherwise this name becomes a new canonical.
    Shorter name wins as canonical when merging.
    """
    if not names:
        return {}

    norm_map: Dict[str, str] = {n: _norm(n) for n in names}
    unique_norms = list(dict.fromkeys(norm_map.values()))  # dedup, preserve order

    if len(unique_norms) == 1:
        canonical = unique_norms[0]
        return {n: canonical for n in names}

    try:
        embeddings = await _embed_texts(unique_norms)
    except Exception as e:
        logger.warning(f"Entity resolution embedding failed: {e}; using normalized names as-is")
        return {n: norm_map[n] for n in names}

    vec_map: Dict[str, List[float]] = dict(zip(unique_norms, embeddings))

    # Greedy merge
    canonicals: List[str] = []
    canon_vecs: List[List[float]] = []
    norm_to_canon: Dict[str, str] = {}

    for norm in unique_norms:
        vec = vec_map[norm]
        best_dist = threshold + 1.0
        best_canon = None
        for c, cv in zip(canonicals, canon_vecs):
            d = _cosine_distance(vec, cv)
            if d < best_dist:
                best_dist = d
                best_canon = c

        if best_canon is not None and best_dist <= threshold:
            # Merge: shorter name wins
            winner = best_canon if len(best_canon) <= len(norm) else norm
            idx = canonicals.index(best_canon)
            canonicals[idx] = winner
            canon_vecs[idx] = vec_map[winner] if winner == norm else cv
            norm_to_canon[norm] = winner
            # Update any previously mapped to old canonical
            for k in list(norm_to_canon.keys()):
                if norm_to_canon[k] == best_canon:
                    norm_to_canon[k] = winner
        else:
            canonicals.append(norm)
            canon_vecs.append(vec)
            norm_to_canon[norm] = norm

    return {n: norm_to_canon[norm_map[n]] for n in names}


# ---------------------------------------------------------------------------
# FalkorDB connection + index management
# ---------------------------------------------------------------------------

_BATCH = 500

_connections: Dict[str, Any] = {}
_conn_lock = asyncio.Lock()


def _get_falkor_connection(graph_name: str):
    """Return a synchronous FalkorDB graph handle (cached)."""
    if graph_name not in _connections:
        db = falkordb.FalkorDB(
            host=settings.GRAPH_DATABASE_URL,
            port=settings.GRAPH_DATABASE_PORT,
            username=settings.GRAPH_DATABASE_USERNAME or None,
            password=settings.GRAPH_DATABASE_PASSWORD or None,
            ssl=settings.GRAPH_DATABASE_SSL,
        )
        _connections[graph_name] = db.select_graph(graph_name)
    return _connections[graph_name]


def _ensure_indexes(g) -> None:
    """Idempotently create vector + range indexes."""
    # Vector index on Chunk.embedding
    try:
        g.query(
            "CALL db.idx.vector.createNodeIndex('Chunk', 'embedding', $dim, 'cosine')",
            {"dim": settings.EMBEDDING_DIM},
        )
    except Exception:
        pass  # Already exists

    # Range indexes for fast property lookups
    for label, prop in [
        ("Chunk", "document_id"),
        ("Entity", "name"),
    ]:
        try:
            g.query(f"CREATE INDEX ON :{label}({prop})")
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Dynamic ontology (in-memory, merged per doc)
# ---------------------------------------------------------------------------

class _OntologySchema:
    def __init__(self):
        self.entity_labels: List[str] = []
        self.relation_labels: List[str] = []


_schemas: Dict[str, _OntologySchema] = {}
_schema_locks: Dict[str, asyncio.Lock] = {}


def _schema_lock(graph_name: str) -> asyncio.Lock:
    if graph_name not in _schema_locks:
        _schema_locks[graph_name] = asyncio.Lock()
    return _schema_locks[graph_name]


async def _ensure_schema(organization_id: str, sample_text: str) -> _OntologySchema:
    """Detect ontology for this doc and merge into org's running schema."""
    graph_name = _graph_name(organization_id)
    async with _schema_lock(graph_name):
        new_schema = await _detect_schema(sample_text, graph_name)
        existing = _schemas.get(graph_name, _OntologySchema())
        merged = _merge_schemas(existing, new_schema, graph_name)
        _schemas[graph_name] = merged
        return merged


async def _detect_schema(sample_text: str, graph_name: str) -> _OntologySchema:
    # Use first 8000 chars as sample — enough context, cheap to send
    sample = sample_text[:8000].strip()
    prompt = _ONTOLOGY_PROMPT.format(sample=sample)
    try:
        raw = await _llm_json(prompt, settings.ONTOLOGY_MODEL)
        data = json.loads(_strip_fences(raw))
    except Exception as e:
        logger.warning(f"Ontology detection failed for {graph_name}: {e}")
        return _OntologySchema()

    schema = _OntologySchema()
    seen_e: set = set()
    for item in data.get("entities", []):
        label = (item.get("label") or "").strip()
        if label and len(label) >= 3 and label not in seen_e:
            seen_e.add(label)
            schema.entity_labels.append(label)

    seen_r: set = set()
    for item in data.get("relations", []):
        label = (item.get("label") or "").strip()
        if label and len(label) >= 3 and label not in seen_r:
            seen_r.add(label)
            schema.relation_labels.append(label)

    logger.info(
        f"Ontology detected for {graph_name}: "
        f"{len(schema.entity_labels)} entity types, {len(schema.relation_labels)} relation types"
    )
    return schema


def _merge_schemas(
    existing: _OntologySchema,
    new: _OntologySchema,
    graph_name: str,
) -> _OntologySchema:
    merged = _OntologySchema()
    seen_e = set(existing.entity_labels)
    merged.entity_labels = list(existing.entity_labels)
    added_e = []
    for label in new.entity_labels:
        if label not in seen_e:
            merged.entity_labels.append(label)
            seen_e.add(label)
            added_e.append(label)

    seen_r = set(existing.relation_labels)
    merged.relation_labels = list(existing.relation_labels)
    added_r = []
    for label in new.relation_labels:
        if label not in seen_r:
            merged.relation_labels.append(label)
            seen_r.add(label)
            added_r.append(label)

    if added_e or added_r:
        logger.info(
            f"Schema extended for {graph_name}: "
            f"+{len(added_e)} entity types, +{len(added_r)} relation types — "
            f"now {len(merged.entity_labels)} entities, {len(merged.relation_labels)} relations"
        )
    return merged


# ---------------------------------------------------------------------------
# Per-chunk extraction
# ---------------------------------------------------------------------------

async def _extract_chunk(
    text: str,
    schema: _OntologySchema,
    sem: asyncio.Semaphore,
) -> Extraction:
    prompt = _build_extract_prompt(schema.entity_labels, schema.relation_labels)
    full_prompt = prompt + f"\n\nPASSAGE:\n{text}"
    async with sem:
        try:
            raw = await _llm_json(full_prompt, settings.EXTRACTION_MODEL)
            data = json.loads(_strip_fences(raw))
            return Extraction.model_validate(data)
        except Exception as e:
            logger.warning(f"Chunk extraction failed: {e}")
            return Extraction()


# ---------------------------------------------------------------------------
# Graph writes
# ---------------------------------------------------------------------------

def _write_to_graph(
    g,
    chunks: List[Dict[str, Any]],
    entity_map: Dict[str, str],          # raw_name → canonical
    triple_rows: List[Dict[str, Any]],
    mention_rows: List[Tuple[str, str]],  # (chunk_id, canonical_entity_name)
    entity_types: Dict[str, str],         # canonical_name → type
) -> Dict[str, int]:
    # ---- Chunks ----
    logger.info(f"Writing {len(chunks)} chunks")
    for i in range(0, len(chunks), _BATCH):
        batch = chunks[i: i + _BATCH]
        g.query(
            """
            UNWIND $rows AS row
            MERGE (c:Chunk {id: row.id})
            SET c.document_id = row.document_id,
                c.text = row.text,
                c.embedding = vecf32(row.embedding)
            """,
            {"rows": batch},
        )

    # ---- Entities ----
    ent_rows = [
        {"name": name, "type": entity_types.get(name, "Unknown")}
        for name in set(entity_map.values())
    ]
    logger.info(f"Writing {len(ent_rows)} entities")
    for i in range(0, len(ent_rows), _BATCH):
        g.query(
            """
            UNWIND $rows AS row
            MERGE (e:Entity {name: row.name})
            SET e.type = row.type
            """,
            {"rows": ent_rows[i: i + _BATCH]},
        )

    # ---- RELATES triples ----
    logger.info(f"Writing {len(triple_rows)} triples")
    for i in range(0, len(triple_rows), _BATCH):
        g.query(
            """
            UNWIND $rows AS row
            MATCH (s:Entity {name: row.subj}), (t:Entity {name: row.obj})
            MERGE (s)-[r:RELATES {triple_id: row.triple_id}]->(t)
            SET r.predicate = row.predicate,
                r.source_chunk = row.source_chunk,
                r.confidence = row.confidence
            """,
            {"rows": triple_rows[i: i + _BATCH]},
        )

    # ---- MENTIONS edges ----
    m_rows = [{"cid": c, "name": n} for c, n in mention_rows]
    logger.info(f"Writing {len(m_rows)} MENTIONS edges")
    for i in range(0, len(m_rows), _BATCH):
        g.query(
            """
            UNWIND $rows AS row
            MATCH (c:Chunk {id: row.cid}), (e:Entity {name: row.name})
            MERGE (c)-[:MENTIONS]->(e)
            """,
            {"rows": m_rows[i: i + _BATCH]},
        )

    return {
        "chunks": len(chunks),
        "entities": len(ent_rows),
        "triples": len(triple_rows),
        "mentions": len(m_rows),
    }


# ---------------------------------------------------------------------------
# GraphRAGClient
# ---------------------------------------------------------------------------

class GraphRAGClient:
    """
    Drop-in replacement for the SDK-based GraphRAGClient.
    Public interface (ingest_text, ingest_chunks, search, delete_document, delete_org)
    is identical so ingestion_service.py requires no changes.
    """

    # ---- ingest ---------------------------------------------------------------

    async def ingest_text(
        self,
        text: str,
        organization_id: str,
        document_id: str,
        filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not text or not text.strip():
            logger.warning(f"Empty text for document {document_id}, skipping ingest")
            return {"ingested": False, "reason": "empty_text"}

        graph_name = _graph_name(organization_id)
        logger.info(f"Ingest start: doc={document_id} graph={graph_name} len={len(text)}")

        # Step 1: detect + merge ontology for this doc
        schema = await _ensure_schema(organization_id, text)

        # Step 2: chunk
        chunker = get_chunker_client()
        try:
            raw_chunks = chunker.chunk_text(text, chunker_type="large_chunk")
            chunk_texts = [c.text for c in raw_chunks if c.text.strip()]
        except Exception as e:
            logger.error(f"Chunking failed for {document_id}: {e}")
            return {"ingested": False, "reason": f"chunking_failed: {e}"}

        if not chunk_texts:
            return {"ingested": False, "reason": "no_chunks"}

        logger.info(f"Chunked doc={document_id} into {len(chunk_texts)} chunks")

        # Step 3: embed + extract in parallel
        sem = asyncio.Semaphore(settings.LLM_CONCURRENCY)

        async def _process(idx: int, chunk_text: str):
            cid = _chunk_id(document_id, idx)
            embedding, extraction = await asyncio.gather(
                _embed_texts([chunk_text]),
                _extract_chunk(chunk_text, schema, sem),
            )
            return cid, chunk_text, embedding[0], extraction

        results = await asyncio.gather(*[_process(i, t) for i, t in enumerate(chunk_texts)])

        # Step 4: collect all raw entity names for resolution
        all_entity_names: List[str] = []
        for _, _, _, extraction in results:
            for e in extraction.entities:
                if e.name.strip():
                    all_entity_names.append(e.name.strip())
            for tr in extraction.triples:
                for n in (tr.subject.strip(), tr.object.strip()):
                    if n:
                        all_entity_names.append(n)

        entity_map = await _resolve_entities(
            list(dict.fromkeys(all_entity_names)),
            threshold=settings.ENTITY_RESOLUTION_THRESHOLD,
        )

        # Step 5: build write payloads
        chunk_rows = []
        mention_rows: List[Tuple[str, str]] = []
        triple_rows: List[Dict[str, Any]] = []
        entity_types: Dict[str, str] = {}
        seen_triples: set = set()

        for cid, chunk_text, embedding, extraction in results:
            chunk_rows.append({
                "id": cid,
                "document_id": document_id,
                "text": chunk_text,
                "embedding": [float(x) for x in embedding],
            })

            for e in extraction.entities:
                raw = e.name.strip()
                if not raw:
                    continue
                canon = entity_map.get(raw, _norm(raw))
                entity_types.setdefault(canon, e.type)
                mention_rows.append((cid, canon))

            for tr in extraction.triples:
                if tr.confidence < settings.MIN_TRIPLE_CONFIDENCE:
                    continue
                subj_raw = tr.subject.strip()
                obj_raw = tr.object.strip()
                if not subj_raw or not obj_raw:
                    continue
                subj = entity_map.get(subj_raw, _norm(subj_raw))
                obj = entity_map.get(obj_raw, _norm(obj_raw))
                if subj == obj:
                    continue
                if subj not in entity_types or obj not in entity_types:
                    continue
                tid = _triple_id(subj, tr.predicate, obj, cid)
                if tid in seen_triples:
                    continue
                seen_triples.add(tid)
                triple_rows.append({
                    "triple_id": tid,
                    "subj": subj,
                    "obj": obj,
                    "predicate": tr.predicate,
                    "source_chunk": cid,
                    "confidence": tr.confidence,
                })

        # Deduplicate mention_rows
        mention_rows = list(set(mention_rows))

        # Step 6: write to FalkorDB (sync client, run in thread)
        g = await asyncio.to_thread(_get_falkor_connection, graph_name)
        await asyncio.to_thread(_ensure_indexes, g)
        counts = await asyncio.to_thread(
            _write_to_graph, g, chunk_rows, entity_map,
            triple_rows, mention_rows, entity_types,
        )

        logger.info(
            f"Ingest complete: doc={document_id} "
            f"chunks={counts['chunks']} entities={counts['entities']} "
            f"triples={counts['triples']} mentions={counts['mentions']}"
        )
        return {
            "ingested": True,
            "graph": graph_name,
            "document_id": document_id,
            **counts,
        }

    async def ingest_chunks(
        self,
        chunks: List[str],
        organization_id: str,
        document_id: str,
    ) -> Dict[str, Any]:
        non_empty = [c for c in chunks if c and c.strip()]
        if not non_empty:
            return {"ingested": False, "reason": "no_chunks"}
        joined = "\n\n---\n\n".join(non_empty)
        return await self.ingest_text(
            text=joined,
            organization_id=organization_id,
            document_id=document_id,
        )

    # ---- search ---------------------------------------------------------------

    async def search(
        self,
        query: str,
        organization_id: str,
        top_k: int = 10,
        document_ids: Optional[List[str]] = None,
        graph_expand: bool = True,
        expand_k: int = 20,
        top_entities: int = 12,
    ) -> List[Dict[str, Any]]:
        if not query or not query.strip():
            return []

        graph_name = _graph_name(organization_id)

        # Phase 1: embed query
        try:
            qv = (await _embed_texts([query.strip()]))[0]
        except Exception as e:
            logger.error(f"Search embedding failed: {e}")
            return []

        g = await asyncio.to_thread(_get_falkor_connection, graph_name)

        # Phase 2: pre-filtered vector search
        try:
            if document_ids:
                vector_rows = await asyncio.to_thread(
                    lambda: g.query(
                        """
                        MATCH (c:Chunk)
                        WHERE c.document_id IN $docs
                        WITH c, vec.cosineDistance(c.embedding, vecf32($qv)) AS dist
                        ORDER BY dist ASC LIMIT $k
                        RETURN c.id, c.document_id, c.text, dist
                        """,
                        {"qv": qv, "k": top_k, "docs": list(document_ids)},
                    ).result_set
                )
            else:
                vector_rows = await asyncio.to_thread(
                    lambda: g.query(
                        """
                        MATCH (c:Chunk)
                        WITH c, vec.cosineDistance(c.embedding, vecf32($qv)) AS dist
                        ORDER BY dist ASC LIMIT $k
                        RETURN c.id, c.document_id, c.text, dist
                        """,
                        {"qv": qv, "k": top_k},
                    ).result_set
                )
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []

        chunks: List[Dict[str, Any]] = [
            {
                "chunk_id": row[0],
                "document_id": row[1],
                "text": row[2],
                "score": float(row[3]),
                "shared_entities": None,
                "via": "vector",
            }
            for row in vector_rows
        ]
        vector_chunk_ids = [c["chunk_id"] for c in chunks]

        # Phase 3: entity expansion via MENTIONS
        anchors: List[str] = []
        if graph_expand and vector_chunk_ids:
            try:
                anchor_rows = await asyncio.to_thread(
                    lambda: g.query(
                        """
                        MATCH (c:Chunk)-[:MENTIONS]->(e:Entity)
                        WHERE c.id IN $cids
                        WITH e, count(DISTINCT c) AS chunk_count
                        ORDER BY chunk_count DESC LIMIT $top_n
                        RETURN e.name
                        """,
                        {"cids": vector_chunk_ids, "top_n": top_entities},
                    ).result_set
                )
                anchors = [row[0] for row in anchor_rows]
            except Exception as e:
                logger.warning(f"Anchor lookup failed: {e}")

            if anchors:
                try:
                    expand_params: Dict[str, Any] = {
                        "names": anchors,
                        "original_cids": vector_chunk_ids,
                        "extra_k": expand_k,
                    }
                    expand_query = """
                        MATCH (c:Chunk)-[:MENTIONS]->(e:Entity)
                        WHERE e.name IN $names
                          AND NOT c.id IN $original_cids
                        """
                    if document_ids:
                        expand_query += "AND c.document_id IN $docs\n"
                        expand_params["docs"] = list(document_ids)
                    expand_query += """
                        WITH c, count(DISTINCT e) AS shared_entities
                        ORDER BY shared_entities DESC LIMIT $extra_k
                        RETURN c.id, c.document_id, c.text, shared_entities
                    """
                    expanded_rows = await asyncio.to_thread(
                        lambda: g.query(expand_query, expand_params).result_set
                    )
                    for row in expanded_rows:
                        chunks.append({
                            "chunk_id": row[0],
                            "document_id": row[1],
                            "text": row[2],
                            "score": None,
                            "shared_entities": int(row[3]),
                            "via": "graph",
                        })
                except Exception as e:
                    logger.warning(f"Graph expand failed: {e}")

        # Phase 4: triples from chunk set
        triples: List[Tuple[str, str, str]] = []
        all_chunk_ids = [c["chunk_id"] for c in chunks]
        if all_chunk_ids:
            try:
                triple_rows = await asyncio.to_thread(
                    lambda: g.query(
                        """
                        MATCH (a:Entity)-[r:RELATES]->(b:Entity)
                        WHERE r.source_chunk IN $cids
                          AND coalesce(r.confidence, 0.0) >= $min_conf
                        RETURN a.name, r.predicate, b.name, r.confidence
                        ORDER BY r.confidence DESC
                        LIMIT 100
                        """,
                        {"cids": all_chunk_ids, "min_conf": settings.MIN_TRIPLE_CONFIDENCE},
                    ).result_set
                )
                triples = [(row[0], row[1], row[2]) for row in triple_rows]
            except Exception as e:
                logger.warning(f"Triple fetch failed: {e}")

        if not chunks:
            return []

        logger.info(
            f"Search: graph={graph_name} query={query[:60]!r} "
            f"chunks={len(chunks)} ({sum(1 for c in chunks if c['via']=='vector')} vector + "
            f"{sum(1 for c in chunks if c['via']=='graph')} graph) "
            f"anchors={len(anchors)} triples={len(triples)}"
        )

        return [{
            "chunks": chunks,
            "anchors": anchors,
            "triples": triples,
            "count": len(chunks),
            "query": query.strip(),
        }]

    # ---- delete ---------------------------------------------------------------

    async def delete_document(
        self, document_id: str, organization_id: str
    ) -> bool:
        try:
            g = await asyncio.to_thread(_get_falkor_connection, _graph_name(organization_id))
            await asyncio.to_thread(
                lambda: g.query(
                    "MATCH (c:Chunk {document_id: $doc_id}) DETACH DELETE c",
                    {"doc_id": document_id},
                )
            )
            logger.info(f"Deleted chunks for doc={document_id}")
            return True
        except Exception as e:
            logger.warning(f"Delete failed for doc={document_id}: {e}")
            return False

    async def delete_org(self, organization_id: str) -> bool:
        graph_name = _graph_name(organization_id)
        try:
            g = await asyncio.to_thread(_get_falkor_connection, graph_name)
            await asyncio.to_thread(lambda: g.query("MATCH (n) DETACH DELETE n"))
            _connections.pop(graph_name, None)
            _schemas.pop(graph_name, None)
            logger.info(f"Deleted all nodes for graph={graph_name}")
            return True
        except Exception as e:
            logger.warning(f"Org delete failed for {organization_id}: {e}")
            return False

    async def shutdown(self) -> None:
        _connections.clear()
        _schemas.clear()


# Singleton
_graphrag_client: Optional[GraphRAGClient] = None


def get_graphrag_client() -> GraphRAGClient:
    global _graphrag_client
    if _graphrag_client is None:
        _graphrag_client = GraphRAGClient()
    return _graphrag_client
