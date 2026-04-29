"""
FalkorDB GraphRAG-SDK Client.

Replaces the previous Cognee + Apache AGE wrappers with FalkorDB's native
graph-RAG SDK. One graph per organization (clean multi-tenant isolation),
one FalkorDB connection pool per organization (cached), and a fresh
``GraphRAG`` facade per call (the SDK's recommended pattern — facades are
not reentrant, but they cheaply share a connection).

Storage:
  - FalkorDB Cloud — graph + vectors (the SDK manages embeddings internally)

Dynamic ontology:
  v1.x of the SDK dropped ``Ontology.from_sources`` (the v0 auto-detect).
  We roll our own: on the first ingest into an org graph, we make a single
  cheap LLM call asking the model to propose entity types + relation types
  for that document, parse the JSON, build a ``GraphSchema``, and cache it
  in memory keyed by graph name. Subsequent ingests reuse that schema so
  every document in the org's graph is extracted under a consistent
  ontology — without the hand-coded schema burden.

LLM:
  Default LLM is OpenRouter (``OpenRouterLLM``) — pick any model id (e.g.
  ``google/gemini-2.5-flash``). Embeddings stay on OpenAI direct via
  ``LiteLLMEmbedder`` because OpenRouter doesn't do embeddings well.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
from functools import lru_cache
from typing import Any, Dict, List, Optional

try:
    import tiktoken  # OpenAI's tokenizer; cl100k is a reasonable proxy for Gemini too
except ImportError:  # pragma: no cover
    tiktoken = None  # type: ignore[assignment]

from graphrag_sdk import (
    ConnectionConfig,
    Embedder,
    EntityType,
    FalkorDBConnection,
    GraphRAG,
    GraphSchema,
    LiteLLM,
    LiteLLMEmbedder,
    LLMInterface,
    RelationType,
    SemanticResolution,
)

from app.logger import logger


# -- helpers ----------------------------------------------------------------


def _graph_name_for_org(organization_id: str) -> str:
    """One FalkorDB graph per organization — hard isolation boundary."""
    return f"org_{organization_id}"


def _env_int(key: str, default: int) -> int:
    raw = os.getenv(key)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _strip_json_fences(text: str) -> str:
    """Strip ```json … ``` fences if the model wraps its reply."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        if text.endswith("```"):
            text = text[:-3].strip()
    return text


@lru_cache(maxsize=1)
def _get_encoder():
    """Cached tiktoken encoder. cl100k_base covers GPT-4/4o; close enough for Gemini.

    Returns None when tiktoken is unavailable — callers fall back to char-based
    estimates (1 token ≈ 4 chars).
    """
    if tiktoken is None:
        return None
    try:
        return tiktoken.get_encoding("cl100k_base")
    except Exception:
        return None


def _truncate_to_tokens(text: str, max_tokens: int) -> tuple[str, int, bool]:
    """Truncate ``text`` to at most ``max_tokens`` tokens.

    Returns ``(truncated_text, original_token_count, was_truncated)``. When
    tiktoken is missing we fall back to a 4-chars-per-token approximation —
    works for graceful degradation but is less precise.
    """
    enc = _get_encoder()
    if enc is None:
        approx_tokens = max(1, len(text) // 4)
        if approx_tokens <= max_tokens:
            return text, approx_tokens, False
        char_cap = max_tokens * 4
        return text[:char_cap], approx_tokens, True

    tokens = enc.encode(text)
    n = len(tokens)
    if n <= max_tokens:
        return text, n, False
    return enc.decode(tokens[:max_tokens]), n, True


# -- ontology auto-detection prompt ----------------------------------------

_ONTOLOGY_DETECT_PROMPT = """\
You are designing a knowledge-graph ontology for a corpus.

Read the SAMPLE TEXT below and propose a compact, faithful ontology that
captures the *kinds of things* and *kinds of relationships* present in
this domain. Aim for breadth, not exhaustiveness — 8 to 14 entity types
and 8 to 16 relationship types is the sweet spot. Prefer specific labels
over generic ones (e.g. ``MoneyAmount`` over ``Number``,
``LaborPosition`` over ``JobTitle``, ``Rate`` over ``Percentage``).

Strict rules:
- Entity labels: PascalCase, singular, no spaces.
- Relation labels: SCREAMING_SNAKE_CASE, verb phrase from source to target.
- Every relation MUST list at least one ``(source_label, target_label)``
  pair drawn from the entity labels you propose.
- No duplicates. No labels of length < 3.

Return ONLY valid JSON in this exact shape — no prose, no fences:

{{"entities": [{{"label": "...", "description": "..."}}, ...],
  "relations": [{{"label": "...", "description": "...",
                  "patterns": [["SrcLabel", "TgtLabel"], ...]}}, ...]}}

SAMPLE TEXT:
\"\"\"{sample}\"\"\"
"""


# -- client -----------------------------------------------------------------


class GraphRAGClient:
    """Thin wrapper around the FalkorDB GraphRAG-SDK.

    Shares one ``FalkorDBConnection`` (and therefore one connection pool)
    per organization graph. Auto-detects an ontology per organization on
    first ingest and caches it for the lifetime of the process.
    """

    def __init__(self) -> None:
        self._host = os.getenv("GRAPH_DATABASE_URL", "localhost")
        self._port = _env_int("GRAPH_DATABASE_PORT", 6379)
        self._username = os.getenv("GRAPH_DATABASE_USERNAME") or None
        self._password = os.getenv("GRAPH_DATABASE_PASSWORD") or None
        self._ssl = os.getenv("GRAPH_DATABASE_SSL", "false").lower() in ("1", "true", "yes")

        # LLM and embedder are stateless — share across all calls.
        self._llm_model = os.getenv("LLM_MODEL", "google/gemini-2.5-flash")
        self._embedding_model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
        self._embedding_dimension = _env_int("EMBEDDING_DIMENSIONS", 1536)
        self._auto_ontology = os.getenv("AUTO_ONTOLOGY", "true").lower() in ("1", "true", "yes")

        self._llm = self._build_llm()
        self._embedder = self._build_embedder()

        # Cached connections + per-graph schemas.
        self._connections: Dict[str, FalkorDBConnection] = {}
        self._schemas: Dict[str, GraphSchema] = {}
        self._lock = asyncio.Lock()
        self._schema_locks: Dict[str, asyncio.Lock] = {}

        logger.info(
            f"✅ GraphRAG client initialized (FalkorDB {self._host}:{self._port}, "
            f"llm={self._llm_model}, embed={self._embedding_model}, "
            f"auto_ontology={self._auto_ontology})"
        )

    # ---- providers --------------------------------------------------------

    def _build_llm(self) -> LLMInterface:
        """Build a LiteLLM instance, routing through OpenRouter when needed.

        LiteLLM's convention: prefix non-OpenAI models with ``openrouter/``
        to route via OpenRouter (it picks up ``OPENROUTER_API_KEY`` from
        env). Native OpenAI models stay as ``openai/<model>``.
        """
        return LiteLLM(model=self._normalise_model(self._llm_model))

    @staticmethod
    def _normalise_model(name: str) -> str:
        """Route any non-OpenAI provider through OpenRouter via LiteLLM."""
        if not name:
            return "openai/gpt-4o-mini"
        # Already prefixed for LiteLLM (openrouter/, openai/, gemini/, etc.)
        if name.startswith(("openai/", "openrouter/", "gemini/", "anthropic/")):
            return name
        # Bare OpenAI name -> openai/...
        if "/" not in name:
            return f"openai/{name}"
        # Provider/model form (google/..., anthropic/..., meta-llama/...) -> route via OpenRouter
        return f"openrouter/{name}"

    def _build_embedder(self) -> Embedder:
        # Embeddings always go to OpenAI directly via LiteLLM.
        model = self._embedding_model
        if "/" not in model:
            model = f"openai/{model}"
        return LiteLLMEmbedder(model=model, dimensions=self._embedding_dimension)

    # ---- connection / facade ---------------------------------------------

    async def _get_connection(self, organization_id: str) -> FalkorDBConnection:
        """Return (and cache) a FalkorDBConnection bound to the org's graph."""
        graph_name = _graph_name_for_org(organization_id)
        async with self._lock:
            conn = self._connections.get(graph_name)
            if conn is None:
                config = ConnectionConfig(
                    host=self._host,
                    port=self._port,
                    username=self._username,
                    password=self._password,
                    graph_name=graph_name,
                    ssl=self._ssl,
                )
                conn = FalkorDBConnection(config)
                self._connections[graph_name] = conn
            return conn

    def _build_rag(
        self,
        conn: FalkorDBConnection,
        schema: Optional[GraphSchema] = None,
    ) -> GraphRAG:
        return GraphRAG(
            connection=conn,
            llm=self._llm,
            embedder=self._embedder,
            schema=schema,
            embedding_dimension=self._embedding_dimension,
        )

    # ---- ontology auto-detection -----------------------------------------

    def _schema_lock(self, graph_name: str) -> asyncio.Lock:
        lock = self._schema_locks.get(graph_name)
        if lock is None:
            lock = asyncio.Lock()
            self._schema_locks[graph_name] = lock
        return lock

    async def _ensure_schema(
        self,
        organization_id: str,
        sample_text: str,
    ) -> Optional[GraphSchema]:
        """Detect a schema for THIS doc and merge it into the org's existing one.

        Why merge per-ingest instead of caching the first call?

        FalkorDB itself is schema-free, but the GraphRAG-SDK constrains
        extraction to whatever ``GraphSchema`` you hand it. If we cached the
        first doc's ontology and a later doc covered a different domain
        (e.g. proposal -> medical report), the LLM would be forced to fit
        intel/medical content into proposal types like ``LaborPosition``,
        producing junk.

        So: every ingest runs a cheap detection on the new doc's sample, and
        the result is unioned (entities + relations, deduped by label) into
        the org's running schema. New types are added, existing types are
        kept. Subsequent ingests use the accumulated schema. This is the
        "dynamic ontology" the FalkorDB marketing implies but doesn't
        actually ship — we implement it here.
        """
        if not self._auto_ontology:
            return None

        graph_name = _graph_name_for_org(organization_id)

        async with self._schema_lock(graph_name):
            existing = self._schemas.get(graph_name)
            new_schema = await self._detect_schema(sample_text, graph_name)
            merged = self._merge_schemas(existing, new_schema, graph_name)
            self._schemas[graph_name] = merged
            return merged

    @staticmethod
    def _merge_schemas(
        existing: Optional[GraphSchema],
        new: GraphSchema,
        graph_name: str,
    ) -> GraphSchema:
        """Union the org's existing schema with a newly detected one.

        Dedup keys:
          - entities: by ``label``
          - relations: by ``(label, frozenset(patterns))`` — same label with
            new directional patterns is treated as an extension, not a clash

        Existing labels win on conflicting descriptions; new labels are
        appended. Patterns referencing labels not in the merged entity set
        are dropped (keeps the schema validator happy).
        """
        if existing is None or (not existing.entities and not existing.relations):
            if new.entities or new.relations:
                logger.info(
                    f"🧬 Schema initialised for graph={graph_name}: "
                    f"{len(new.entities)} entity types, "
                    f"{len(new.relations)} relation types"
                )
            return new

        # 1. Merge entities by label (existing wins on description).
        seen_e: dict[str, EntityType] = {e.label: e for e in existing.entities}
        added_entities: List[str] = []
        for ent in new.entities:
            if ent.label not in seen_e:
                seen_e[ent.label] = ent
                added_entities.append(ent.label)
        merged_entities = list(seen_e.values())
        declared = {e.label for e in merged_entities}

        # 2. Merge relations by label, accumulating patterns.
        rel_index: dict[str, RelationType] = {}
        for rel in existing.relations:
            rel_index[rel.label] = rel
        added_relations: List[str] = []
        for rel in new.relations:
            valid_patterns = [
                (s, t) for (s, t) in rel.patterns if s in declared and t in declared
            ]
            if not valid_patterns:
                continue
            existing_rel = rel_index.get(rel.label)
            if existing_rel is None:
                rel_index[rel.label] = RelationType(
                    label=rel.label,
                    description=rel.description,
                    patterns=valid_patterns,
                )
                added_relations.append(rel.label)
            else:
                # Extend existing relation with any new patterns.
                pattern_set = {tuple(p) for p in existing_rel.patterns}
                fresh = [p for p in valid_patterns if tuple(p) not in pattern_set]
                if fresh:
                    rel_index[rel.label] = RelationType(
                        label=existing_rel.label,
                        description=existing_rel.description or rel.description,
                        patterns=existing_rel.patterns + fresh,
                    )
        merged_relations = list(rel_index.values())

        if added_entities or added_relations:
            logger.info(
                f"🧬 Schema extended for graph={graph_name}: "
                f"+{len(added_entities)} entity types ({', '.join(added_entities[:8])}"
                f"{'...' if len(added_entities) > 8 else ''}), "
                f"+{len(added_relations)} relation types ({', '.join(added_relations[:8])}"
                f"{'...' if len(added_relations) > 8 else ''}) — "
                f"now {len(merged_entities)} entities, {len(merged_relations)} relations"
            )
        else:
            logger.info(
                f"🧬 Schema unchanged for graph={graph_name} "
                f"(new doc fit existing {len(merged_entities)}-entity ontology)"
            )

        return GraphSchema(entities=merged_entities, relations=merged_relations)

    async def _detect_schema(self, sample_text: str, graph_name: str) -> GraphSchema:
        """One LLM call -> JSON ontology -> GraphSchema.

        Sample size is bounded by ``ONTOLOGY_SAMPLE_TOKENS`` (default 900_000)
        so we don't blow past Gemini Flash's 1M-token context (the prompt
        scaffold + JSON output need headroom).
        """
        max_tokens = _env_int("ONTOLOGY_SAMPLE_TOKENS", 900_000)
        sample, total_tokens, truncated = _truncate_to_tokens(
            sample_text.strip(), max_tokens
        )
        if truncated:
            sample = sample + "\n... [truncated for ontology detection]"
            logger.info(
                f"🧬 Doc has {total_tokens} tokens; sampling first {max_tokens} "
                f"for ontology detection (graph={graph_name})"
            )
        else:
            logger.info(
                f"🧬 Sampling all {total_tokens} tokens for ontology "
                f"detection (graph={graph_name})"
            )

        prompt = _ONTOLOGY_DETECT_PROMPT.format(sample=sample)
        logger.info(f"🧬 Auto-detecting ontology for graph={graph_name}...")

        try:
            response = await self._llm.ainvoke(prompt)
            raw = (response.content or "").strip()
        except Exception as e:
            logger.warning(f"⚠️ Ontology detect LLM call failed ({e}); using default schema")
            return GraphSchema()

        try:
            data = json.loads(_strip_json_fences(raw))
        except json.JSONDecodeError as e:
            logger.warning(
                f"⚠️ Ontology detect returned invalid JSON ({e}); using default schema"
            )
            return GraphSchema()

        return self._schema_from_dict(data, graph_name)

    @staticmethod
    def _schema_from_dict(data: Any, graph_name: str) -> GraphSchema:
        if not isinstance(data, dict):
            return GraphSchema()

        entities_raw = data.get("entities") or []
        relations_raw = data.get("relations") or []

        entities: List[EntityType] = []
        seen_e: set[str] = set()
        for item in entities_raw:
            if not isinstance(item, dict):
                continue
            label = (item.get("label") or "").strip()
            if not label or len(label) < 3 or label in seen_e:
                continue
            seen_e.add(label)
            entities.append(
                EntityType(
                    label=label,
                    description=(item.get("description") or "").strip() or None,
                )
            )

        declared = {e.label for e in entities}
        relations: List[RelationType] = []
        seen_r: set[str] = set()
        for item in relations_raw:
            if not isinstance(item, dict):
                continue
            label = (item.get("label") or "").strip()
            if not label or len(label) < 3 or label in seen_r:
                continue
            patterns_raw = item.get("patterns") or []
            patterns: List[tuple[str, str]] = []
            for p in patterns_raw:
                if isinstance(p, (list, tuple)) and len(p) == 2:
                    src, tgt = str(p[0]).strip(), str(p[1]).strip()
                    if src in declared and tgt in declared:
                        patterns.append((src, tgt))
            if not patterns:
                # Skip relations with no valid pattern — the SDK warns on these
                # and they don't help the LLM at extraction time.
                continue
            seen_r.add(label)
            relations.append(
                RelationType(
                    label=label,
                    description=(item.get("description") or "").strip() or None,
                    patterns=patterns,
                )
            )

        logger.info(
            f"🧬 Ontology detected for graph={graph_name}: "
            f"{len(entities)} entity types, {len(relations)} relation types"
        )
        if entities:
            logger.info(
                "   entities: "
                + ", ".join(e.label for e in entities[:20])
                + ("..." if len(entities) > 20 else "")
            )
        return GraphSchema(entities=entities, relations=relations)

    # ---- ingest -----------------------------------------------------------

    async def ingest_text(
        self,
        text: str,
        organization_id: str,
        document_id: str,
        filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Ingest a single document's raw content into the org's graph."""
        if not text or not text.strip():
            logger.warning(f"Empty text for document {document_id}, skipping ingest")
            return {"ingested": False, "reason": "empty_text"}

        schema = await self._ensure_schema(organization_id, text)
        conn = await self._get_connection(organization_id)
        rag = self._build_rag(conn, schema=schema)

        graph_name = _graph_name_for_org(organization_id)
        logger.info(
            f"🧠 GraphRAG ingest: doc={document_id} graph={graph_name} "
            f"len={len(text)} schema_entities={len(schema.entities) if schema else 0}"
        )

        # Semantic dedup: merge near-duplicate entities ("PriceIQ" ≈ "PriceIQ — …")
        # within the same label group. 0.85 is moderate — tighten if dedup is
        # over-merging; loosen toward 0.95 (the SDK default) if it's too sloppy.
        sim_threshold = float(os.getenv("RESOLUTION_SIMILARITY_THRESHOLD", "0.85"))
        resolver = SemanticResolution(
            llm=self._llm,
            embedder=self._embedder,
            similarity_threshold=sim_threshold,
        )

        try:
            result = await rag.ingest(text=text, document_id=document_id, resolver=resolver)
            await rag.finalize()

            # Stamp document_id provenance onto chunks / entities / edges so
            # multi-document filtering at search time is a property check.
            await self._stamp_document_provenance(conn, document_id)

            logger.info(
                f"✅ GraphRAG ingest complete for doc={document_id} "
                f"(nodes={getattr(result, 'nodes_created', '?')}, "
                f"edges={getattr(result, 'relationships_created', '?')})"
            )
            return {
                "ingested": True,
                "graph": graph_name,
                "document_id": document_id,
                "nodes_created": getattr(result, "nodes_created", None),
                "relationships_created": getattr(result, "relationships_created", None),
            }
        except Exception as e:
            logger.error(f"❌ GraphRAG ingest failed for {document_id}: {e}")
            raise

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

    # ---- provenance stamping ---------------------------------------------

    async def _stamp_document_provenance(
        self, conn: FalkorDBConnection, document_id: str
    ) -> None:
        """After ingest, tag every node/edge derived from this doc.

        - Chunks get a single ``document_id`` (chunks belong to one doc).
        - Entities and RELATES edges get a ``document_ids`` list, since a
          single entity can be merged across multiple ingested docs.
        """
        try:
            # 1. Chunks: each chunk PART_OF exactly one Document.
            await conn.query(
                "MATCH (d:Document {path: $doc_id})-[:PART_OF]->(c:Chunk) "
                "SET c.document_id = $doc_id",
                params={"doc_id": document_id},
            )

            # Collect chunk ids for this doc once; reuse for entity + edge tagging.
            r = await conn.query(
                "MATCH (c:Chunk {document_id: $doc_id}) RETURN c.id AS id",
                params={"doc_id": document_id},
            )
            chunk_ids = [row[0] for row in r.result_set if row[0]]
            if not chunk_ids:
                logger.info(
                    f"📌 No chunks linked to doc={document_id}; skipping entity/edge tagging"
                )
                return

            # 2. Entities: append to document_ids list (dedup, multi-doc safe).
            await conn.query(
                "MATCH (e:__Entity__) "
                "WHERE any(cid IN coalesce(e.source_chunk_ids, []) WHERE cid IN $chunk_ids) "
                "SET e.document_ids = CASE "
                "  WHEN e.document_ids IS NULL THEN [$doc_id] "
                "  WHEN $doc_id IN e.document_ids THEN e.document_ids "
                "  ELSE e.document_ids + [$doc_id] END",
                params={"doc_id": document_id, "chunk_ids": chunk_ids},
            )

            # 3. RELATES edges: same pattern.
            await conn.query(
                "MATCH ()-[r:RELATES]->() "
                "WHERE any(cid IN coalesce(r.source_chunk_ids, []) WHERE cid IN $chunk_ids) "
                "SET r.document_ids = CASE "
                "  WHEN r.document_ids IS NULL THEN [$doc_id] "
                "  WHEN $doc_id IN r.document_ids THEN r.document_ids "
                "  ELSE r.document_ids + [$doc_id] END",
                params={"doc_id": document_id, "chunk_ids": chunk_ids},
            )

            logger.info(f"📌 Stamped document_id provenance for doc={document_id}")
        except Exception as e:
            # Non-fatal — search filter will fall back to a permissive mode.
            logger.warning(f"⚠️ Provenance stamp failed for doc={document_id}: {e}")

    # ---- search -----------------------------------------------------------

    async def search(
        self,
        query: str,
        organization_id: str,
        top_k: int = 10,
        document_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Two paths:

        1. ``document_ids`` is empty/None  -> full SDK MultiPathRetrieval
           (best quality: keyword extraction, multi-hop traversal, LLM rerank).
        2. ``document_ids`` set            -> custom pre-filtered Cypher
           retrieval that scopes vector search to chunks/entities/relations
           tagged with one of those doc ids. Faster + correct for filtering.
        """
        if not query or not query.strip():
            return []

        if document_ids:
            return await self._filtered_search(
                query, organization_id, top_k, document_ids
            )
        return await self._sdk_search(query, organization_id, top_k)

    async def _sdk_search(
        self, query: str, organization_id: str, top_k: int
    ) -> List[Dict[str, Any]]:
        """Unfiltered path — SDK's full MultiPathRetrieval."""
        graph_name = _graph_name_for_org(organization_id)
        schema = self._schemas.get(graph_name)
        conn = await self._get_connection(organization_id)
        rag = self._build_rag(conn, schema=schema)

        try:
            retriever_result = await rag.retrieve(query)
        except Exception as e:
            logger.error(f"❌ GraphRAG retrieve failed: {e}")
            return []

        items = list(getattr(retriever_result, "items", []) or [])[:top_k]
        results = [
            {
                "source": "graphrag",
                "payload": {
                    "text": getattr(it, "content", None) or str(it),
                    "score": getattr(it, "score", None),
                    "metadata": getattr(it, "metadata", {}) or {},
                },
            }
            for it in items
        ]
        logger.info(
            f"🔍 GraphRAG search (sdk): '{query[:60]}' graph={graph_name} "
            f"results={len(results)}"
        )
        return results

    async def _filtered_search(
        self,
        query: str,
        organization_id: str,
        top_k: int,
        document_ids: List[str],
    ) -> List[Dict[str, Any]]:
        """Pre-filtered retrieval scoped to ``document_ids``.

        Strategy: use FalkorDB's HNSW vector indexes (the only way to get
        graph-scale similarity), over-fetch K * 5 candidates, then filter by
        ``document_id`` / ``document_ids`` properties stamped at ingest time.

        Three parallel queries — chunks (passages), entities (descriptions),
        relations (facts) — each with its own vector index. Results are
        aggregated into 3 markdown sections matching the SDK output shape so
        the agent's downstream code is unchanged.
        """
        graph_name = _graph_name_for_org(organization_id)
        conn = await self._get_connection(organization_id)
        over_fetch = max(top_k * 5, 25)

        # 1. Embed the query once (single OpenAI call).
        query_vec = await self._embedder.aembed_query(query)

        async def _chunks() -> List[Any]:
            r = await conn.query(
                "CALL db.idx.vector.queryNodes('Chunk', 'embedding', $k, vecf32($v)) "
                "YIELD node AS c, score "
                "WHERE c.document_id IN $docs "
                "RETURN c.id AS id, c.text AS text, score "
                "ORDER BY score DESC "
                "LIMIT $top",
                params={
                    "k": over_fetch,
                    "v": query_vec,
                    "docs": list(document_ids),
                    "top": top_k,
                },
            )
            return r.result_set or []

        async def _entities() -> List[Any]:
            r = await conn.query(
                "CALL db.idx.vector.queryNodes('__Entity__', 'embedding', $k, vecf32($v)) "
                "YIELD node AS e, score "
                "WHERE any(d IN coalesce(e.document_ids, []) WHERE d IN $docs) "
                "RETURN e.name AS name, e.type AS type, e.description AS description, score "
                "ORDER BY score DESC "
                "LIMIT $top",
                params={
                    "k": over_fetch,
                    "v": query_vec,
                    "docs": list(document_ids),
                    "top": top_k,
                },
            )
            return r.result_set or []

        async def _facts() -> List[Any]:
            r = await conn.query(
                "CALL db.idx.vector.queryRelationships('RELATES', 'embedding', $k, vecf32($v)) "
                "YIELD relationship AS r, score "
                "WHERE any(d IN coalesce(r.document_ids, []) WHERE d IN $docs) "
                "RETURN startNode(r).name AS src, endNode(r).name AS tgt, "
                "       r.rel_type AS rel, r.fact AS fact, score "
                "ORDER BY score DESC "
                "LIMIT $top",
                params={
                    "k": over_fetch,
                    "v": query_vec,
                    "docs": list(document_ids),
                    "top": top_k,
                },
            )
            return r.result_set or []

        try:
            chunks_rows, entity_rows, fact_rows = await asyncio.gather(
                _chunks(), _entities(), _facts(), return_exceptions=True
            )
        except Exception as e:
            logger.error(f"❌ Filtered search failed: {e}")
            return []

        chunks_rows = chunks_rows if isinstance(chunks_rows, list) else []
        entity_rows = entity_rows if isinstance(entity_rows, list) else []
        fact_rows = fact_rows if isinstance(fact_rows, list) else []

        results: List[Dict[str, Any]] = []

        # Entities section — LLM-generated descriptions are gold here.
        if entity_rows:
            lines = []
            for row in entity_rows:
                name, type_, desc, _score = row
                if desc:
                    lines.append(f"- {name} ({type_}): {desc}")
                else:
                    lines.append(f"- {name} ({type_})")
            results.append({
                "source": "graphrag",
                "payload": {
                    "text": "## Key Entities\n" + "\n".join(lines),
                    "score": None,
                    "metadata": {"section": "entities"},
                },
            })

        # Facts section — typed graph relationships with natural-language facts.
        if fact_rows:
            lines = []
            for row in fact_rows:
                src, tgt, rel, fact, _score = row
                if fact:
                    lines.append(f"- {src} —[{rel}]→ {tgt}: {fact}")
                else:
                    lines.append(f"- {src} —[{rel}]→ {tgt}")
            results.append({
                "source": "graphrag",
                "payload": {
                    "text": "## Knowledge Graph Facts\n" + "\n".join(lines),
                    "score": None,
                    "metadata": {"section": "facts"},
                },
            })

        # Passages section — raw chunk text with provenance.
        if chunks_rows:
            blocks = []
            for row in chunks_rows:
                cid, text, _score = row
                blocks.append(f"[Source: {cid}]\n{text}")
            results.append({
                "source": "graphrag",
                "payload": {
                    "text": "## Source Document Passages\n" + "\n\n".join(blocks),
                    "score": None,
                    "metadata": {"section": "passages"},
                },
            })

        logger.info(
            f"🔍 GraphRAG search (filtered): '{query[:60]}' graph={graph_name} "
            f"docs={len(document_ids)} entities={len(entity_rows)} "
            f"facts={len(fact_rows)} chunks={len(chunks_rows)}"
        )
        return results

    # ---- delete -----------------------------------------------------------

    async def delete_document(
        self, document_id: str, organization_id: str
    ) -> bool:
        try:
            conn = await self._get_connection(organization_id)
            await conn.query(
                "MATCH (n) WHERE n.document_id = $doc_id DETACH DELETE n",
                params={"doc_id": document_id},
            )
            await conn.query(
                "MATCH (d:Document) WHERE d.id = $doc_id DETACH DELETE d",
                params={"doc_id": document_id},
            )
            logger.info(f"✅ GraphRAG deleted doc={document_id}")
            return True
        except Exception as e:
            logger.warning(f"⚠️ GraphRAG delete failed for doc={document_id}: {e}")
            return False

    async def delete_org(self, organization_id: str) -> bool:
        try:
            conn = await self._get_connection(organization_id)
            await conn.delete_graph()
            graph_name = _graph_name_for_org(organization_id)
            self._schemas.pop(graph_name, None)
            logger.info(f"✅ GraphRAG dropped graph={graph_name}")
            return True
        except Exception as e:
            logger.warning(f"⚠️ GraphRAG org delete failed for {organization_id}: {e}")
            return False

    async def shutdown(self) -> None:
        for graph_name, conn in list(self._connections.items()):
            try:
                await conn.close()
            except Exception as e:
                logger.warning(f"Error closing graph={graph_name}: {e}")
        self._connections.clear()
        self._schemas.clear()


_graphrag_client: Optional[GraphRAGClient] = None


def get_graphrag_client() -> GraphRAGClient:
    global _graphrag_client
    if _graphrag_client is None:
        _graphrag_client = GraphRAGClient()
    return _graphrag_client
