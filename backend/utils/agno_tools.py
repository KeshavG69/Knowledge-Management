"""
Agno Tools for Knowledge Management
Creates custom tools for agno agent
"""

from typing import List, Dict, Any, Optional
from agno.agent import Agent
from clients.pinecone_client import get_pinecone_client
from app.logger import logger


def create_knowledge_retriever(
    organization_id: Optional[str] = None,
    user_id: Optional[str] = None,
    document_ids: Optional[list[str]] = None,
    num_documents: int = 10
) :
    """
    Create a knowledge retriever tool for searching the knowledge base

    Args:
        organization_id: Optional organization ID for namespace filtering
        user_id: Optional user ID for filtering
        document_ids: Optional list of document IDs to filter results
        num_documents: Maximum number of documents to retrieve

    Returns:
        Tool: Agno tool for knowledge retrieval
    """
    # Store default in closure
    num_documents_default = num_documents

    def search_knowledge_base(
        query: str,
        agent: Optional[Agent] = None,
        num_documents: Optional[int] = None
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Search the knowledge base using semantic search

        Args:
            query: Search query
            agent: Optional agent instance
            num_documents: Maximum number of results to return

        Returns:
            Optional[List[Dict[str, Any]]]: List with summary as first item and documents as remaining items
        """
        # Validate query
        if not query or not query.strip():
            logger.warning("Empty or invalid query provided to search_knowledge_base")
            return None

        # Use default from outer scope if not provided
        if num_documents is None:
            num_documents = num_documents_default

        try:
            logger.info(
                f"🔍 Searching knowledge base: '{query}' "
                f"(limit: {num_documents}, docs: {len(document_ids) if document_ids else 'all'})"
            )

            # Get Pinecone client
            pinecone_client = get_pinecone_client()

            # Build filter for RBAC and document filtering
            filter_dict = {}
            if user_id:
                filter_dict["user_id"] = user_id

            # Add document_ids filter if provided
            if document_ids and len(document_ids) > 0:
                filter_dict["document_id"] = {"$in": document_ids}
                logger.debug(f"Filtering by document_ids: {document_ids}")

            # Query Pinecone with scores
            results = pinecone_client.similarity_search_with_score(
                query=query,
                k=num_documents,
                namespace=organization_id,
                filter=filter_dict if filter_dict else None
            )

            if not results:
                logger.info("No results found in knowledge base")
                return None

            # Format results as list of dicts
            documents = []
            for doc, score in results:
                metadata = doc.metadata

                # Create document dict
                doc_dict = {
                    "text": doc.page_content,
                    "file_id": metadata.get("document_id", ""),
                    "datasource": "files",  # Default to files
                    "metadata": {
                        "file_name": metadata.get("file_name", "Unknown"),
                        "folder_name": metadata.get("folder_name", "N/A"),
                        "score": score,
                    }
                }

                # Check if this is a video chunk
                if "video_id" in metadata:
                    doc_dict["datasource"] = "videos"
                    doc_dict["metadata"].update({
                        "video_id": metadata.get("video_id"),
                        "video_name": metadata.get("video_name"),
                        "clip_start": metadata.get("clip_start"),
                        "clip_end": metadata.get("clip_end"),
                        "scene_id": metadata.get("scene_id"),
                        "key_frame_timestamp": metadata.get("key_frame_timestamp"),
                    })

                documents.append(doc_dict)

            # Create summary as first item

            # Return list with summary first, then documents
            logger.info(f"✅ Found {len(documents)} relevant results")
            return  documents

        except Exception as e:
            logger.error(f"❌ Knowledge base search failed: {str(e)}")
            return None

    # Create and return the tool
    return search_knowledge_base
