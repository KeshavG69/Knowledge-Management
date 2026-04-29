"""
Agno Tools for Knowledge Management
Single GraphRAG-backed retriever — FalkorDB GraphRAG-SDK blends vector
and graph search internally. The Agno agent synthesizes the final answer.
"""

from typing import List, Dict, Any, Optional
from agno.agent import Agent
from clients.graphrag_client import get_graphrag_client
from app.logger import logger


def create_knowledge_retriever(
    organization_id: Optional[str] = None,
    user_id: Optional[str] = None,
    document_ids: Optional[list[str]] = None,
    num_documents: int = 10,
):
    """
    Create a knowledge retriever tool for the Agno agent.

    Returns a callable that performs hybrid retrieval (vector + graph) via
    Cognee over the organization's dataset. Optional document_ids filter
    restricts retrieval to a subset of docs in that dataset.
    """
    num_documents_default = num_documents

    async def search_knowledge_base(
        query: str,
        agent: Optional[Agent] = None,
        num_documents: Optional[int] = None,
    ) -> Optional[List[Dict[str, Any]]]:
        if not query or not query.strip():
            logger.warning("Empty or invalid query provided to search_knowledge_base")
            return None

        if num_documents is None:
            num_documents = num_documents_default

        # Empty document_ids filter = explicit "search nothing" signal
        if document_ids is not None and len(document_ids) == 0:
            logger.info("No documents selected - returning empty results")
            return None

        if not organization_id:
            logger.warning("No organization_id provided to search_knowledge_base")
            return None

        try:
            logger.info(
                f"🔍 GraphRAG search: '{query[:80]}' "
                f"(limit: {num_documents}, docs: {len(document_ids) if document_ids else 'all'})"
            )

            graphrag_client = get_graphrag_client()
            raw_results = await graphrag_client.search(
                query=query,
                organization_id=organization_id,
                top_k=num_documents,
                document_ids=document_ids,
            )

            if not raw_results:
                logger.info("No results from GraphRAG")
                return None

            # Normalize GraphRAG results into the dict shape the agent expects.
            documents: List[Dict[str, Any]] = []
            for item in raw_results:
                source = item.get("source", "graphrag")
                payload = item.get("payload")

                text_content = _extract_text(payload)
                if not text_content:
                    continue

                documents.append({
                    "text": text_content,
                    "file_id": _extract_document_id(payload) or "",
                    "datasource": "graph",
                    "source": source,
                    "metadata": {
                        "file_name": _extract_filename(payload) or "Knowledge Graph",
                        "folder_name": "N/A",
                    },
                })

            logger.info(f"✅ GraphRAG search: {len(documents)} results normalized")
            return documents

        except Exception as e:
            logger.error(f"❌ GraphRAG search failed: {e}")
            import traceback
            traceback.print_exc()
            return None

    return search_knowledge_base


def _extract_text(payload: Any) -> str:
    """Best-effort extraction of text content from a Cognee result payload."""
    if payload is None:
        return ""
    if isinstance(payload, str):
        return payload
    if isinstance(payload, dict):
        for key in ("text", "chunk", "content", "summary", "description"):
            val = payload.get(key)
            if isinstance(val, str) and val.strip():
                return val
        # Insights-style triplets: (subject, predicate, object)
        if {"source", "target"}.issubset(payload.keys()):
            rel = payload.get("relationship") or payload.get("predicate") or "related_to"
            return f"{payload['source']} --{rel}--> {payload['target']}"
        return str(payload)
    if isinstance(payload, (list, tuple)):
        return " ".join(str(x) for x in payload)
    return str(payload)


def _extract_document_id(payload: Any) -> Optional[str]:
    if isinstance(payload, dict):
        for key in ("document_id", "doc_id", "node_set", "source_document_id"):
            val = payload.get(key)
            if isinstance(val, str):
                return val
            if isinstance(val, list) and val:
                return str(val[0])
    return None


def _extract_filename(payload: Any) -> Optional[str]:
    if isinstance(payload, dict):
        for key in ("file_name", "filename", "name", "title"):
            val = payload.get(key)
            if isinstance(val, str):
                return val
    return None
