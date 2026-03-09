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

        # Initialize AGEGraph with connection parameters
        self.age_graph = AGEGraph(
            graph_name="knowledge_graph",
            conf={
                "database": self.database,
                "user": self.username,
                "password": self.password,
                "host": self.host,
                "port": self.port,
            }
        )

        # Strip semicolons from queries (Apache AGE doesn't accept them)
        _original_query = self.age_graph.query
        self.age_graph.query = lambda q: _original_query(q.strip().rstrip(';'))

        # Initialize LLM for entity extraction (smaller model for cost efficiency)
        self.extraction_llm = get_llm(model="nvidia/nemotron-3-nano-30b-a3b", provider="openrouter")

        # Initialize LLM for Cypher query generation (GPT-4o for better accuracy)
        self.query_llm = get_llm(model="gpt-4.1", provider="openai")

        # LLMGraphTransformer with ignore_tool_usage to bypass JSON schema requirement
        self.llm_transformer = LLMGraphTransformer(
            llm=self.extraction_llm,
            ignore_tool_usage=True  # Bypass structured output, use text parsing instead
        )

        # Initialize GraphCypherQAChain for natural language queries
        self.query_chain = GraphCypherQAChain.from_llm(
            llm=self.query_llm,  # Use GPT-4o for better Cypher generation
            graph=self.age_graph,
            return_direct=True,  # Return raw Cypher results, no LLM interpretation
            verbose=True,
            allow_dangerous_requests=True  # Required for security acknowledgment
        )

        logger.info(f"✅ Apache AGE graph client initialized: knowledge_graph")

    async def add_chunks_as_graph(
        self,
        document_id: str,
        organization_id: str,
        user_id: str,
        filename: str,
        chunks: List[str],
        chunk_metadatas: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Add document chunks to the graph with automatic entity/relationship extraction using LLM
        Each chunk is processed separately for better entity extraction (chunk-level extraction)

        Args:
            document_id: Document UUID
            organization_id: Organization UUID for multi-tenancy
            user_id: User UUID for multi-tenancy
            filename: Document filename
            chunks: List of text chunks
            chunk_metadatas: Optional list of metadata dicts for each chunk

        Returns:
            Dict with extraction statistics:
            {
                "total_chunks": int,
                "chunks_processed": int,
                "total_nodes": int,
                "total_relationships": int
            }

        Example:
            stats = await client.add_chunks_as_graph(
                document_id=doc_id,
                organization_id=org_id,
                user_id=user_id,
                filename="report.pdf",
                chunks=["chunk 1 text...", "chunk 2 text..."],
                chunk_metadatas=[{"chunk_index": 0}, {"chunk_index": 1}]
            )
        """
        try:
            total_nodes = 0
            total_relationships = 0
            chunks_processed = 0

            logger.info(f"🤖 Processing {len(chunks)} chunks from {filename} for graph extraction...")

            # Process each chunk separately for better entity extraction (chunk-level)
            for idx, chunk_text in enumerate(chunks):
                # Get chunk metadata
                chunk_meta = chunk_metadatas[idx] if chunk_metadatas and idx < len(chunk_metadatas) else {}
                chunk_index = chunk_meta.get("chunk_index", idx)

                # Create LangChain Document with multi-tenancy metadata
                doc_metadata = {
                    "document_id": document_id,
                    "organization_id": organization_id,
                    "user_id": user_id,
                    "filename": filename,
                    "chunk_index": chunk_index,
                    **chunk_meta
                }

                document = Document(
                    page_content=chunk_text,
                    metadata=doc_metadata
                )

                try:
                    # Extract entities and relationships using LLM for this chunk
                    graph_documents = self.llm_transformer.convert_to_graph_documents([document])

                    # Add multi-tenancy and chunk metadata to all nodes and relationships
                    for graph_doc in graph_documents:
                        # Add metadata to all nodes
                        for node in graph_doc.nodes:
                            node.properties["organization_id"] = organization_id
                            node.properties["user_id"] = user_id
                            node.properties["document_id"] = document_id
                            node.properties["chunk_index"] = chunk_index
                            node.properties["filename"] = filename

                        # Add metadata to all relationships
                        for relationship in graph_doc.relationships:
                            relationship.properties["organization_id"] = organization_id
                            relationship.properties["user_id"] = user_id
                            relationship.properties["document_id"] = document_id
                            relationship.properties["chunk_index"] = chunk_index

                        # Count entities and relationships
                        total_nodes += len(graph_doc.nodes)
                        total_relationships += len(graph_doc.relationships)

                    # Add to AGE graph
                    self.age_graph.add_graph_documents(graph_documents)
                    chunks_processed += 1

                    logger.info(f"  ✅ Chunk {chunk_index}: {len(graph_documents[0].nodes)} nodes, {len(graph_documents[0].relationships)} relationships")

                except Exception as chunk_error:
                    logger.error(f"  ❌ Failed to process chunk {chunk_index}: {str(chunk_error)}")
                    # Continue processing other chunks even if one fails
                    continue

            # Refresh schema after adding new data
            self.refresh_schema()

            stats = {
                "total_chunks": len(chunks),
                "chunks_processed": chunks_processed,
                "total_nodes": total_nodes,
                "total_relationships": total_relationships
            }

            logger.info(f"✅ Graph extraction complete for {filename}: {chunks_processed}/{len(chunks)} chunks, {total_nodes} nodes, {total_relationships} relationships")
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
            # Build document filter string
            doc_ids_str = ", ".join([f"'{doc_id}'" for doc_id in document_ids])

            # Enhance question with filtering context
            enhanced_question = f"""{question}

IMPORTANT: Filter all queries with these constraints:
- organization_id must equal '{organization_id}'
- document_id must be IN [{doc_ids_str}]"""

            if user_id:
                enhanced_question += f"\n- user_id must equal '{user_id}'"

            # Execute query - LLM generates Cypher, returns direct results
            results = self.query_chain.invoke({"query": enhanced_question})

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
