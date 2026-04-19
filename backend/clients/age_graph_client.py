"""
Apache AGE Graph Client
Graph database operations using PostgreSQL + Apache AGE extension
Uses LangChain integration with LLMGraphTransformer for chunk-level entity extraction
Query method uses LLM to generate Cypher from natural language, returns direct results
"""

from typing import Optional, List, Dict, Any
from langchain_community.graphs.age_graph import AGEGraph
from langchain_experimental.graph_transformers import LLMGraphTransformer
from langchain_community.chains.graph_qa.cypher import GraphCypherQAChain
from langchain_core.documents import Document
from clients.ultimate_llm import get_llm
from app.settings import settings
from app.logger import logger


class LazySchemaAGEGraph(AGEGraph):
    """AGEGraph subclass that skips schema refresh at init time.
    Schema is refreshed lazily on first query or explicit refresh_schema() call.
    This saves 4+ remote DB round trips (~2 min on Railway) at startup."""

    def __init__(self, graph_name: str, conf: Dict[str, Any], create: bool = True) -> None:
        import psycopg2

        self.graph_name = graph_name
        self.connection = psycopg2.connect(**conf)

        with self._get_cursor() as curs:
            graph_id_query = "SELECT graphid FROM ag_catalog.ag_graph WHERE name = '{}'".format(graph_name)
            curs.execute(graph_id_query)
            data = curs.fetchone()

            if data is None:
                if create:
                    curs.execute("SELECT ag_catalog.create_graph('{}');".format(graph_name))
                    self.connection.commit()
                else:
                    raise Exception(f'Graph "{graph_name}" does not exist and create=False')
                curs.execute(graph_id_query)
                data = curs.fetchone()

            self.graphid = data.graphid

        # Skip refresh_schema() — will be called lazily when needed
        self.schema = ""
        self.structured_schema = {"node_props": {}, "rel_props": {}, "relationships": [], "metadata": {}}


class AGEGraphClient:
    """Client for Apache AGE graph operations using LangChain"""

    def __init__(self):
        """Initialize Apache AGE graph client with LangChain"""
        self.connection_string = settings.POSTGRES_GRAPH_URL

        if not self.connection_string:
            raise ValueError("POSTGRES_GRAPH_URL not configured")

        # Parse connection URL for AGEGraph parameters
        # Format: postgresql://user:password@host:port/database
        parts = self.connection_string.replace("postgresql://", "").split("@")
        user_pass = parts[0].split(":")
        host_port_db = parts[1].split("/")
        host_port = host_port_db[0].split(":")

        self.username = user_pass[0]
        self.password = user_pass[1] if len(user_pass) > 1 else ""
        self.host = host_port[0]
        self.port = int(host_port[1]) if len(host_port) > 1 else 5432
        self.database = host_port_db[1] if len(host_port_db) > 1 else "soldieriq"

        # Initialize AGEGraph — skips schema refresh for fast startup
        self.age_graph = LazySchemaAGEGraph(
            graph_name="knowledge_graph",
            conf={
                "database": self.database,
                "user": self.username,
                "password": self.password,
                "host": self.host,
                "port": self.port,
            }
        )

        # Store AGE config for reconnection
        self._age_conf = {
            "database": self.database,
            "user": self.username,
            "password": self.password,
            "host": self.host,
            "port": self.port,
        }

        # Wrap query with auto-reconnect on stale connections
        _original_query = self.age_graph.query

        def _resilient_query(q: str):
            clean_q = q.strip().rstrip(';')
            try:
                return _original_query(clean_q)
            except Exception as e:
                err_msg = str(e).lower()
                if "closed" in err_msg or "connection" in err_msg or "server closed" in err_msg:
                    logger.warning(f"⚠️ AGE connection lost, reconnecting...")
                    self._reconnect_age()
                    return self.age_graph.query(clean_q)
                raise

        self.age_graph.query = _resilient_query

        # Initialize LLM for entity extraction (mini model — sufficient for NER, ~80% cheaper)
        self.extraction_llm = get_llm(model="gpt-4.1-mini", provider="openai")

        # LLMGraphTransformer for entity extraction
        # gpt-4.1-mini supports tool calling, so use structured output (more reliable than text parsing)
        self.llm_transformer = LLMGraphTransformer(
            llm=self.extraction_llm,
        )

        # Query chain is lazy-loaded — needs schema, so refreshes on first use
        self._query_chain = None
        self._query_chain_lock = __import__('threading').Lock()

        logger.info(f"✅ Apache AGE graph client initialized: knowledge_graph (schema deferred)")

    def _reconnect_age(self):
        """Recreate AGE graph connection when the old one goes stale."""
        try:
            self.age_graph = LazySchemaAGEGraph(
                graph_name="knowledge_graph",
                conf=self._age_conf,
            )
            # Re-apply the fast schema if query chain was already initialized
            if self._query_chain is not None:
                self._fast_schema_refresh()
            logger.info("✅ AGE connection re-established")
        except Exception as e:
            logger.error(f"❌ AGE reconnection failed: {e}")
            raise

    def _batched_add_graph_documents(self, graph_documents: List) -> None:
        """
        Write all graph documents to AGE in a single transaction with
        all SQL statements concatenated into one execute() call.
        This reduces N round trips to 1.
        """
        import psycopg2

        # Build all SQL statements first
        statements = []
        for doc in graph_documents:
            for node in doc.nodes:
                node.properties["id"] = node.id
                label = self.age_graph.clean_graph_labels(node.type)
                props = self.age_graph._format_properties(node.properties)
                cypher = f'MERGE (n:`{label}` {{`id`: "{node.id}"}}) SET n = {props}'
                statements.append(self.age_graph._wrap_query(cypher, "knowledge_graph"))

            for edge in doc.relationships:
                edge.source.properties["id"] = edge.source.id
                edge.target.properties["id"] = edge.target.id
                inputs = {
                    "f_label": self.age_graph.clean_graph_labels(edge.source.type),
                    "f_properties": self.age_graph._format_properties(edge.source.properties),
                    "t_label": self.age_graph.clean_graph_labels(edge.target.type),
                    "t_properties": self.age_graph._format_properties(edge.target.properties),
                    "r_label": self.age_graph.clean_graph_labels(edge.type).upper(),
                    "r_properties": self.age_graph._format_properties(edge.properties),
                }
                cypher = (
                    f'MERGE (from:`{inputs["f_label"]}` {inputs["f_properties"]}) '
                    f'MERGE (to:`{inputs["t_label"]}` {inputs["t_properties"]}) '
                    f'MERGE (from)-[:`{inputs["r_label"]}` {inputs["r_properties"]}]->(to)'
                )
                statements.append(self.age_graph._wrap_query(cypher, "knowledge_graph"))

        logger.info(f"  📤 Sending {len(statements)} SQL statements in single execute...")

        # Execute all statements in one network call (with reconnect on stale connection)
        def _execute():
            conn = self.age_graph.connection
            with conn.cursor() as curs:
                combined_sql = "; ".join(statements)
                curs.execute(combined_sql)
                conn.commit()

        try:
            _execute()
        except (psycopg2.Error, Exception) as e:
            err_msg = str(e).lower()
            if "closed" in err_msg or "connection" in err_msg or "server closed" in err_msg:
                logger.warning(f"⚠️ AGE connection lost during write, reconnecting...")
                self._reconnect_age()
                _execute()
            else:
                raise

    def _fast_schema_refresh(self):
        """
        Fast schema refresh using ag_catalog metadata tables + sampled triples.
        Gets labels from catalog (~1ms) and samples relationship patterns (~2s)
        instead of LangChain's full graph scan (2+ min on remote DB).
        """
        import psycopg2
        try:
            conn = self.age_graph.connection
            with conn.cursor() as curs:
                # Get node labels from catalog (instant, no graph scan)
                curs.execute("""
                    SELECT name FROM ag_catalog.ag_label
                    WHERE graph = (SELECT graphid FROM ag_catalog.ag_graph WHERE name = 'knowledge_graph')
                    AND kind = 'v' AND name != '_ag_label_vertex'
                """)
                node_labels = [row[0] for row in curs.fetchall()]

                # Get edge labels from catalog
                curs.execute("""
                    SELECT name FROM ag_catalog.ag_label
                    WHERE graph = (SELECT graphid FROM ag_catalog.ag_graph WHERE name = 'knowledge_graph')
                    AND kind = 'e' AND name != '_ag_label_edge'
                """)
                edge_labels = [row[0] for row in curs.fetchall()]

            # Sample relationship patterns (source_label)-[edge_label]->(target_label)
            # This is critical — without this, the LLM hallucinates relationships
            triples = []
            triple_schema = []
            for e_label in edge_labels[:30]:  # Cap to avoid too many queries
                try:
                    query = f"""
                        MATCH (a)-[e:`{e_label}`]->(b)
                        WITH a, e, b LIMIT 1
                        RETURN DISTINCT labels(a) AS from, type(e) AS edge, labels(b) AS to
                    """
                    results = self.age_graph.query(query)
                    for r in results:
                        src = r.get("from", ["Unknown"])[0] if isinstance(r.get("from"), list) else r.get("from", "Unknown")
                        edge = r.get("edge", e_label)
                        tgt = r.get("to", ["Unknown"])[0] if isinstance(r.get("to"), list) else r.get("to", "Unknown")
                        triples.append(f"(:{src})-[:{edge}]->(:{tgt})")
                        triple_schema.append({"start": src, "type": edge, "end": tgt})
                except Exception:
                    pass  # Skip edges with no data

            # Build schema string with relationship patterns
            triples_str = "\n            ".join(triples) if triples else "None"
            self.age_graph.schema = f"""
            Node labels: {', '.join(node_labels) if node_labels else 'None'}
            Relationship patterns:
            {triples_str}
            All nodes have properties: id, organization_id, user_id, document_id, filename
            All edges have properties: organization_id, user_id, document_id
            """
            self.age_graph.structured_schema = {
                "node_props": {label: [] for label in node_labels},
                "rel_props": {label: [] for label in edge_labels},
                "relationships": triple_schema,
                "metadata": {},
            }
            logger.info(f"✅ Fast schema: {len(node_labels)} node labels, {len(edge_labels)} edge labels, {len(triples)} relationship patterns")
        except psycopg2.Error as e:
            logger.warning(f"⚠️ Fast schema failed: {e}, falling back to full refresh")
            self.age_graph.refresh_schema()

    @property
    def query_chain(self):
        """Lazy-load GraphCypherQAChain on first access. Thread-safe — if pre-warm is
        already initializing this, concurrent callers wait instead of double-initing."""
        if self._query_chain is None:
            with self._query_chain_lock:
                if self._query_chain is None:  # Double-check after acquiring lock
                    logger.info("🔗 Initializing GraphCypherQAChain (fast schema + query LLM)...")
                    self._fast_schema_refresh()
                    query_llm = get_llm(model="google/gemini-3-flash-preview", provider="openrouter")

                    # Custom prompt for Apache AGE (not Neo4j)
                    from langchain_core.prompts import PromptTemplate
                    cypher_prompt = PromptTemplate(
                        input_variables=["schema", "question"],
                        template="""Generate a Cypher query for Apache AGE (PostgreSQL graph extension).

OUTPUT: Only pure Cypher. No SQL wrapper, no explanations, no markdown.

SYNTAX RULES:
- ONE MATCH clause only
- EVERY RETURN field MUST use AS alias (no dots in column names)
- NO map projections, list comprehensions, OPTIONAL MATCH, UNION, WITH
- Use backticks for multi-word labels: MATCH (n:`Mountain_peak`)

QUERY STRATEGY:
- The node property "id" contains the entity name (e.g. "India", "Himalayas", "Agriculture")
- Extract key entities/topics from the QUESTION and filter nodes using WHERE a.id CONTAINS 'keyword'
- Use multiple OR conditions to match different relevant keywords from the question
- The question includes REQUIRED WHERE filters — you MUST include them in the WHERE clause
- Combine the entity filters AND the required filters in the same WHERE clause

EXAMPLES:
Question: "Tell me about India's economy\n\nREQUIRED WHERE filters:\na.organization_id = 'org1' AND a.document_id IN ['abc']"
MATCH (a)-[r]->(b) WHERE (a.id CONTAINS 'Economy' OR a.id CONTAINS 'India' OR a.id CONTAINS 'Gdp') AND a.organization_id = 'org1' AND a.document_id IN ['abc'] RETURN a.id AS source, type(r) AS rel, b.id AS target

Question: "PMCS maintenance checks\n\nREQUIRED WHERE filters:\na.organization_id = 'org1' AND a.document_id IN ['xyz']"
MATCH (a)-[r]->(b) WHERE (a.id CONTAINS 'Pmcs' OR a.id CONTAINS 'Maintenance' OR a.id CONTAINS 'Check' OR a.id CONTAINS 'Service') AND a.organization_id = 'org1' AND a.document_id IN ['xyz'] RETURN a.id AS source, type(r) AS rel, b.id AS target

Question: "safety warnings and cautions\n\nREQUIRED WHERE filters:\na.organization_id = 'org1' AND a.document_id IN ['xyz']"
MATCH (a)-[r]->(b) WHERE (a.id CONTAINS 'Warning' OR a.id CONTAINS 'Caution' OR a.id CONTAINS 'Safety' OR a.id CONTAINS 'Danger') AND a.organization_id = 'org1' AND a.document_id IN ['xyz'] RETURN a.id AS source, type(r) AS rel, b.id AS target

Schema:
{schema}

Question:
{question}"""
                    )

                    self._query_chain = GraphCypherQAChain.from_llm(
                        llm=query_llm,
                        graph=self.age_graph,
                        cypher_prompt=cypher_prompt,
                        return_direct=True,
                        verbose=True,
                        allow_dangerous_requests=True
                    )
                    logger.info("✅ GraphCypherQAChain ready")
        return self._query_chain

    async def add_chunks_as_graph(
        self,
        document_id: str,
        organization_id: str,
        user_id: str,
        filename: str,
        chunks: List[str],
        chunk_metadatas: Optional[List[Dict[str, Any]]] = None,
        max_concurrency: int = 20,
        batch_size: int = 3
    ) -> Dict[str, Any]:
        """
        Add document chunks to the graph with automatic entity/relationship extraction using LLM.
        Small chunks are batched together (batch_size) to reduce LLM calls.
        Batches are processed with high concurrency (max_concurrency=20).

        Args:
            document_id: Document UUID
            organization_id: Organization UUID for multi-tenancy
            user_id: User UUID for multi-tenancy
            filename: Document filename
            chunks: List of text chunks
            chunk_metadatas: Optional list of metadata dicts for each chunk
            max_concurrency: Max parallel LLM extraction calls (default 20)
            batch_size: Number of small chunks to combine per LLM call (default 3)

        Returns:
            Dict with extraction statistics
        """
        import asyncio

        try:
            # Batch small chunks together to reduce LLM calls
            # e.g. 31 chunks with batch_size=3 → 11 LLM calls instead of 31
            batched_docs = []
            for i in range(0, len(chunks), batch_size):
                batch_texts = chunks[i:i + batch_size]
                batch_indices = list(range(i, min(i + batch_size, len(chunks))))

                combined_text = "\n\n---\n\n".join(batch_texts)
                first_meta = chunk_metadatas[i] if chunk_metadatas and i < len(chunk_metadatas) else {}

                document = Document(
                    page_content=combined_text,
                    metadata={
                        "document_id": document_id,
                        "organization_id": organization_id,
                        "user_id": user_id,
                        "filename": filename,
                        "chunk_indices": batch_indices,
                        **{k: v for k, v in first_meta.items() if k != "chunk_index"}
                    }
                )
                batched_docs.append((batch_indices, document))

            num_batches = len(batched_docs)
            logger.info(
                f"🤖 Processing {len(chunks)} chunks from {filename} "
                f"({num_batches} batches of ~{batch_size}, concurrency={max_concurrency})..."
            )

            semaphore = asyncio.Semaphore(max_concurrency)

            async def process_batch(batch_idx: int, chunk_indices: List[int], document: Document):
                try:
                    async with semaphore:
                        graph_documents = await self.llm_transformer.aconvert_to_graph_documents([document])

                    for graph_doc in graph_documents:
                        for node in graph_doc.nodes:
                            node.properties["organization_id"] = organization_id
                            node.properties["user_id"] = user_id
                            node.properties["document_id"] = document_id
                            node.properties["filename"] = filename

                        for relationship in graph_doc.relationships:
                            relationship.properties["organization_id"] = organization_id
                            relationship.properties["user_id"] = user_id
                            relationship.properties["document_id"] = document_id

                    nodes = sum(len(gd.nodes) for gd in graph_documents)
                    rels = sum(len(gd.relationships) for gd in graph_documents)
                    logger.info(f"  ✅ Batch {batch_idx} (chunks {chunk_indices}): {nodes} nodes, {rels} relationships")
                    return (graph_documents, nodes, rels, True)

                except Exception as batch_error:
                    logger.error(f"  ❌ Failed batch {batch_idx} (chunks {chunk_indices}): {str(batch_error)}")
                    return ([], 0, 0, False)

            results = await asyncio.gather(*[
                process_batch(i, indices, doc)
                for i, (indices, doc) in enumerate(batched_docs)
            ])

            # Collect all graph documents and write to DB in one shot
            all_graph_docs = []
            total_nodes = 0
            total_relationships = 0
            batches_processed = 0
            for graph_docs, nodes, rels, success in results:
                total_nodes += nodes
                total_relationships += rels
                if success:
                    batches_processed += 1
                    all_graph_docs.extend(graph_docs)

            if all_graph_docs:
                logger.info(f"💾 Writing {total_nodes} nodes + {total_relationships} relationships to AGE graph (single transaction)...")
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, self._batched_add_graph_documents, all_graph_docs)
                logger.info(f"✅ All graph documents written to AGE")

            stats = {
                "total_chunks": len(chunks),
                "chunks_processed": batches_processed * batch_size,
                "total_nodes": total_nodes,
                "total_relationships": total_relationships
            }

            logger.info(
                f"✅ Graph extraction complete for {filename}: "
                f"{batches_processed}/{num_batches} batches, "
                f"{total_nodes} nodes, {total_relationships} relationships"
            )
            return stats

        except Exception as e:
            logger.error(f"❌ Failed to add chunks to graph: {str(e)}")
            raise Exception(f"Failed to add chunks to graph: {str(e)}")

    def query(
        self,
        question: str,
        organization_id: str,
        document_ids: List[str],
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Query the graph using natural language
        LLM converts question to Cypher query, executes it, returns direct database results
        No LLM interpretation of results - raw data only
        Only returns data from specified documents

        Args:
            question: Natural language question
            organization_id: Organization UUID for filtering
            document_ids: List of document IDs to search within
            user_id: Optional user UUID for filtering

        Returns:
            List[Dict]: Direct Cypher query results from database

        Example:
            # Find all entities in specific documents
            results = client.query(
                question="What entities are mentioned?",
                organization_id="org-456",
                document_ids=["doc-123", "doc-456"]
            )

            # Find relationships in documents
            results = client.query(
                question="What companies is John Doe related to?",
                organization_id="org-456",
                document_ids=["doc-123"]
            )

            # Get entity counts
            results = client.query(
                question="How many Person entities are there?",
                organization_id="org-456",
                document_ids=["doc-123", "doc-456", "doc-789"]
            )
        """
        try:
            # Build filter values for the Cypher WHERE clause
            doc_ids_str = ", ".join([f"'{doc_id}'" for doc_id in document_ids])
            filter_clause = f"a.organization_id = '{organization_id}' AND a.document_id IN [{doc_ids_str}]"
            if user_id:
                filter_clause += f" AND a.user_id = '{user_id}'"

            # Pass the question cleanly — filters are structured, not mixed into the question text
            structured_query = f"""{question}

REQUIRED WHERE filters (MUST include in every query):
{filter_clause}"""

            results = self.query_chain.invoke({"query": structured_query})

            logger.info(f"✅ Query executed: '{question}' on {len(document_ids)} document(s)")
            return results

        except Exception as e:
            logger.error(f"❌ Query failed: {str(e)}")
            raise Exception(f"Query failed: {str(e)}")

    def refresh_schema(self):
        """
        Refresh graph schema information
        Call this after adding/modifying graph data to update schema cache
        """
        try:
            self.age_graph.refresh_schema()
            logger.info("✅ Graph schema refreshed")
        except Exception as e:
            logger.error(f"❌ Failed to refresh schema: {str(e)}")
            raise

    def get_schema(self) -> str:
        """
        Get the current graph schema (node types, relationship types)

        Returns:
            str: Schema description
        """
        try:
            schema = self.age_graph.get_schema
            logger.info("✅ Retrieved graph schema")
            return schema
        except Exception as e:
            logger.error(f"❌ Failed to get graph schema: {str(e)}")
            raise

    def delete_document(
        self,
        document_id: str,
        organization_id: str
    ) -> bool:
        """
        Delete all nodes and relationships associated with a document

        Args:
            document_id: Document UUID
            organization_id: Organization UUID

        Returns:
            bool: True if successful
        """
        try:
            # Delete all nodes and relationships for this document
            cypher = f"""
                MATCH (n)
                WHERE n.document_id = '{document_id}' AND n.organization_id = '{organization_id}'
                DETACH DELETE n
            """

            self.age_graph.query(cypher)
            self.refresh_schema()
            logger.info(f"✅ Deleted all graph data for document {document_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to delete document from graph: {str(e)}")
            raise


# Singleton instance
_age_graph_client: Optional[AGEGraphClient] = None


def get_age_graph_client() -> AGEGraphClient:
    """
    Get or create AGEGraphClient singleton instance

    Returns:
        AGEGraphClient: Singleton client instance
    """
    global _age_graph_client
    if _age_graph_client is None:
        _age_graph_client = AGEGraphClient()
    return _age_graph_client
