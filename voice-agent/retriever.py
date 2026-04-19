"""Minimal pgvector retriever for the voice agent.

Queries the same `vector_embeddings` collection the backend indexes into
(LangChain PGVector schema). Sync under the hood; we wrap with asyncio.to_thread
so it doesn't block the voice event loop.

No AGE graph search — voice is vector-only for latency. If you need hybrid
retrieval, use the backend chat endpoint.
"""

from __future__ import annotations

import asyncio
import logging
from functools import lru_cache
from typing import Any

from langchain_openai import OpenAIEmbeddings
from langchain_postgres import PGVector
from sqlalchemy import create_engine

from settings import settings

logger = logging.getLogger("voice-agent.retriever")


@lru_cache(maxsize=1)
def _get_vector_store() -> PGVector:
    if not settings.POSTGRES_VECTOR_URL:
        raise RuntimeError("POSTGRES_VECTOR_URL is not configured")
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured for embeddings")

    engine = create_engine(
        settings.POSTGRES_VECTOR_URL,
        pool_size=2,
        max_overflow=2,
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args={
            "connect_timeout": 10,
            "options": "-c statement_timeout=30000",
        },
    )
    embeddings = OpenAIEmbeddings(
        openai_api_key=settings.OPENAI_API_KEY,
        model="text-embedding-3-small",
    )
    return PGVector(
        embeddings=embeddings,
        collection_name="vector_embeddings",
        connection=engine,
        use_jsonb=True,
    )


async def search(
    query: str,
    user_id: str,
    organization_id: str,
    document_ids: list[str],
    k: int = 5,
) -> list[dict[str, Any]]:
    """Return the top-k chunks from pgvector for the given scope.

    Each hit: {text, file_name, document_id, score}.
    """
    if not query.strip() or not document_ids:
        return []

    filter_dict: dict[str, Any] = {
        "user_id": user_id,
        "organization_id": {"$eq": organization_id},
        "document_id": {"$in": document_ids},
    }

    def _sync_search() -> list[tuple]:
        store = _get_vector_store()
        return store.similarity_search_with_score(query, k=k, filter=filter_dict)

    try:
        results = await asyncio.to_thread(_sync_search)
    except Exception:
        logger.exception("pgvector search failed")
        return []

    hits: list[dict[str, Any]] = []
    for doc, score in results:
        hits.append(
            {
                "text": doc.page_content,
                "file_name": doc.metadata.get("file_name", "Unknown source"),
                "document_id": doc.metadata.get("document_id", ""),
                "score": float(score),
            }
        )
    return hits
