"""
Agno Tools for Knowledge Management
Creates custom tools for agno agent with hybrid retrieval (vector + graph)
"""

import asyncio
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from agno.agent import Agent
from clients.pgvector_client import get_pgvector_client
from clients.age_graph_client import get_age_graph_client
from app.logger import logger


def reciprocal_rank_fusion(
    rankings: List[List[Tuple[str, Dict[str, Any]]]],
    k: int = 60
) -> List[Tuple[str, float, Dict[str, Any]]]:
    """
    Combine multiple ranked lists using Reciprocal Rank Fusion (RRF)

    RRF Score = sum(1 / (k + rank)) for each ranking where item appears

    Args:
        rankings: List of ranked lists, where each list contains (id, metadata) tuples
        k: Constant for RRF calculation (default: 60)

    Returns:
        List of (id, rrf_score, metadata) tuples sorted by RRF score descending
    """
    rrf_scores = defaultdict(float)
    metadata_map = {}  # Store metadata for each ID

    for ranking in rankings:
        for rank, (item_id, metadata) in enumerate(ranking, start=1):
            # Calculate RRF score contribution from this ranking
            rrf_scores[item_id] += 1.0 / (k + rank)

            # Store metadata (use first occurrence or merge)
            if item_id not in metadata_map:
                metadata_map[item_id] = metadata
            else:
                # Merge metadata from different sources
                metadata_map[item_id].update(metadata)

    # Sort by RRF score descending
    sorted_results = sorted(
        [(item_id, score, metadata_map[item_id]) for item_id, score in rrf_scores.items()],
        key=lambda x: x[1],
        reverse=True
    )

    return sorted_results


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

    async def search_knowledge_base(
        query: str,
        agent: Optional[Agent] = None,
        num_documents: Optional[int] = None
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Hybrid search using pgvector (semantic) + AGE graph (entity-based)

        Retrieval Strategy:
        1. pgvector: Get num_documents results via semantic vector similarity search
        2. AGE Graph: Get num_documents results via entity and relationship traversal
        3. Combine: Return vector results + graph results (no fusion, total = 2 * num_documents)

        Args:
            query: Search query (NOT enhanced - graph client handles filtering)
            agent: Optional agent instance
            num_documents: Number of results to get from EACH source

        Returns:
            Optional[List[Dict[str, Any]]]: List of documents (num_documents from vector + num_documents from graph)
        """
        # Validate query
        if not query or not query.strip():
            logger.warning("Empty or invalid query provided to search_knowledge_base")
            return None

        # Use default from outer scope if not provided
        if num_documents is None:
            num_documents = num_documents_default

        # Check if document_ids filter would return nothing
        if document_ids is not None and len(document_ids) == 0:
            logger.info("No documents selected - returning empty results")
            return None

        try:
            logger.info(
                f"🔍 Hybrid search (vector + graph): '{query}' "
                f"(limit: {num_documents}, docs: {len(document_ids) if document_ids else 'all'})"
            )

            # ========================================================================
            # Run vector + graph search in PARALLEL via asyncio
            # ========================================================================
            loop = asyncio.get_event_loop()

            def _vector_search():
                try:
                    pgvector_client = get_pgvector_client()
                    filter_dict = {}
                    if user_id:
                        filter_dict["user_id"] = user_id
                    if document_ids:
                        filter_dict["document_id"] = {"$in": document_ids}

                    vector_results = pgvector_client.similarity_search_with_score(
                        query=query,
                        k=num_documents,
                        namespace=organization_id,
                        filter=filter_dict if filter_dict else None
                    )

                    vector_ranking = []
                    for doc, score in vector_results:
                        chunk_id = f"vec_{hash(doc.page_content)}"
                        metadata = {
                            "text": doc.page_content,
                            "file_id": doc.metadata.get("document_id", ""),
                            "datasource": "files",
                            "vector_score": float(score),
                            "source": "vector",
                            "metadata": {
                                "file_name": doc.metadata.get("file_name", "Unknown"),
                                "folder_name": doc.metadata.get("folder_name", "N/A"),
                                "file_key": doc.metadata.get("file_key", ""),
                            }
                        }
                        if "video_id" in doc.metadata:
                            metadata["datasource"] = "videos"
                            metadata["metadata"].update({
                                "video_id": doc.metadata.get("video_id"),
                                "video_name": doc.metadata.get("video_name"),
                                "clip_start": doc.metadata.get("clip_start"),
                                "clip_end": doc.metadata.get("clip_end"),
                                "scene_id": doc.metadata.get("scene_id"),
                                "key_frame_timestamp": doc.metadata.get("key_frame_timestamp"),
                                "keyframe_file_key": doc.metadata.get("keyframe_file_key", ""),
                            })
                        vector_ranking.append((chunk_id, metadata))

                    logger.info(f"  📊 Vector: {len(vector_ranking)} results")
                    return vector_ranking
                except Exception as e:
                    logger.warning(f"  ⚠️  Vector search failed: {str(e)}")
                    return []

            def _graph_search():
                try:
                    if not document_ids:
                        return []
                    age_client = get_age_graph_client()
                    graph_results = age_client.query(
                        question=query,
                        organization_id=organization_id,
                        document_ids=document_ids,
                        user_id=user_id
                    )

                    graph_ranking = []
                    if graph_results:
                        results_list = []
                        if isinstance(graph_results, list):
                            results_list = graph_results
                        elif isinstance(graph_results, dict):
                            results_list = [graph_results]
                        else:
                            try:
                                results_list = list(graph_results)
                            except:
                                results_list = [graph_results]

                        for idx, result in enumerate(results_list[:num_documents]):
                            result_id = f"graph_{idx}_{hash(str(result))}"
                            text_content = str(result)
                            entity_id = None
                            if isinstance(result, dict):
                                entity_id = result.get("entity_id") or result.get("id") or result.get("n", {}).get("id") if isinstance(result.get("n"), dict) else None

                            metadata = {
                                "text": text_content if not entity_id else f"Entity: {entity_id}",
                                "file_id": result.get("document_id", "") if isinstance(result, dict) else "",
                                "datasource": "graph",
                                "source": "graph",
                                "graph_data": result,
                                "metadata": {
                                    "file_name": result.get("filename", "Graph Entity") if isinstance(result, dict) else "Graph Entity",
                                    "folder_name": "N/A",
                                    "entity_id": entity_id
                                }
                            }
                            graph_ranking.append((result_id, metadata))

                    if graph_ranking:
                        logger.info(f"  🔗 Graph: {len(graph_ranking)} results")
                    return graph_ranking
                except Exception as e:
                    logger.warning(f"  ⚠️  Graph search failed: {str(e)}")
                    return []

            # Run both in parallel — each in its own thread via run_in_executor
            vector_ranking, graph_ranking = await asyncio.gather(
                loop.run_in_executor(None, _vector_search),
                loop.run_in_executor(None, _graph_search),
            )

            rankings = []
            if vector_ranking:
                rankings.append(vector_ranking)
            if graph_ranking:
                rankings.append(graph_ranking)

            # ========================================================================
            # 3. COMBINE RESULTS: Vector + Graph (no fusion)
            # ========================================================================
            if not rankings:
                logger.info("No results from any source")
                return None

            # Combine all results without RRF fusion
            documents = []

            for ranking in rankings:
                for item_id, metadata in ranking:
                    doc_dict = metadata.copy()
                    documents.append(doc_dict)

            vector_count = len(rankings[0]) if len(rankings) > 0 else 0
            graph_count = len(rankings[1]) if len(rankings) > 1 else 0

            logger.info(
                f"✅ Hybrid search: {len(documents)} results "
                f"(vector: {vector_count}, graph: {graph_count})"
            )

            return documents

        except Exception as e:
            logger.error(f"❌ Hybrid search failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    # Create and return the tool
    return search_knowledge_base
