"""
Pinecone Vector Database Client
Uses LangChain for vector storage and retrieval operations
"""

from typing import Optional, List, Dict, Any
from langchain_pinecone import PineconeVectorStore
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from pinecone import Pinecone, ServerlessSpec
from app.settings import settings
from app.logger import logger


class PineconeClient:
    """Client for Pinecone vector database operations using LangChain"""

    def __init__(self):
        """Initialize Pinecone client with LangChain"""
        import os
        self.api_key = settings.PINECONE_API_KEY
        self.index_name = settings.PINECONE_INDEX_NAME
        self.embedding_model = settings.OPENAI_API_KEY

        if not self.api_key:
            raise ValueError("PINECONE_API_KEY not configured")
        if not self.index_name:
            raise ValueError("PINECONE_INDEX_NAME not configured")
        if not self.embedding_model:
            raise ValueError("OPENAI_API_KEY not configured for embeddings")

        # CRITICAL: Disable gRPC and threading to prevent thread pool creation in Celery
        os.environ['PINECONE_GRPC_ENABLED'] = 'false'
        os.environ['OPENAI_NO_HTTPX_POOL'] = '1'  # Disable OpenAI's httpx connection pool

        # Initialize Pinecone with minimal threading (REST API only)
        self.pc = Pinecone(api_key=self.api_key, pool_threads=1, source_tag="celery-worker")

        # CRITICAL: Monkey-patch to prevent thread pool creation in ApiClient
        self._patch_pinecone_no_threading()

        # Initialize OpenAI embeddings with sync HTTP client (no thread pools)
        import httpx
        sync_http_client = httpx.Client(
            timeout=httpx.Timeout(60.0),
            limits=httpx.Limits(max_connections=1, max_keepalive_connections=0)
        )
        self.embeddings = OpenAIEmbeddings(
            openai_api_key=self.embedding_model,
            model="text-embedding-3-small",  # Efficient embedding model
            http_client=sync_http_client  # Use sync client, no thread pools
        )
        self._embedding_http_client = sync_http_client  # Store for cleanup

        # Check if index exists, create if not
        self._ensure_index_exists()

        # Cache index host for direct REST API calls (avoid describe_index in hot path)
        try:
            index_info = self.pc.describe_index(self.index_name)
            self.index_host = index_info.host
            logger.info(f"✅ Cached index host: {self.index_host}")
        except Exception as e:
            logger.warning(f"Could not cache index host: {str(e)}")
            self.index_host = None

        # Initialize LangChain vector store
        self.vector_store = PineconeVectorStore(
            index_name=self.index_name,
            embedding=self.embeddings
        )

        logger.info(f"✅ Pinecone client initialized with index: {self.index_name}")

    def _patch_pinecone_no_threading(self):
        """
        Monkey-patch Pinecone's ApiClient to prevent thread pool creation

        This prevents the ApiClient from creating ThreadPools which cause
        "can't start new thread" errors in Celery workers.
        """
        try:
            from pinecone.openapi_support import api_client

            # Store original call_api method
            original_call_api = api_client.ApiClient.call_api

            # Create patched version that doesn't use thread pools
            def patched_call_api(self, *args, **kwargs):
                # Override async behavior - force synchronous
                kwargs['_preload_content'] = True
                kwargs['async_req'] = False

                # Temporarily bypass pool property by calling REST directly
                # This avoids ThreadPool creation
                if hasattr(self, '_pool'):
                    saved_pool = self._pool
                else:
                    saved_pool = None

                self._pool = None  # Prevent pool access

                try:
                    # Make synchronous REST call
                    return original_call_api(self, *args, **kwargs)
                finally:
                    if saved_pool is not None:
                        self._pool = saved_pool

            # Apply monkey patch
            api_client.ApiClient.call_api = patched_call_api
            logger.info("✅ Applied Pinecone no-threading patch")

        except Exception as e:
            logger.warning(f"Could not apply Pinecone threading patch: {str(e)}")

    def cleanup(self):
        """Clean up Pinecone client resources and thread pools"""
        try:
            # Close the OpenAI embeddings HTTP client
            if hasattr(self, '_embedding_http_client') and self._embedding_http_client:
                self._embedding_http_client.close()
            # Close the Pinecone client's thread pool
            if hasattr(self.pc, '_pool') and self.pc._pool:
                self.pc._pool.close()
                self.pc._pool.join()
            logger.info("✅ Cleaned up Pinecone client")
        except Exception as e:
            logger.warning(f"Error cleaning up Pinecone client: {str(e)}")

    def _ensure_index_exists(self):
        """Ensure Pinecone index exists, create if not"""
        try:
            existing_indexes = [index.name for index in self.pc.list_indexes()]

            if self.index_name not in existing_indexes:
                logger.info(f"Creating new Pinecone index: {self.index_name}")

                # Create index with serverless spec
                self.pc.create_index(
                    name=self.index_name,
                    dimension=1536,  # OpenAI text-embedding-3-small dimension
                    metric="cosine",
                    spec=ServerlessSpec(
                        cloud="aws",
                        region="us-east-1"
                    )
                )

                logger.info(f"✅ Pinecone index created: {self.index_name}")
            else:
                logger.info(f"✅ Pinecone index exists: {self.index_name}")

        except Exception as e:
            logger.error(f"❌ Failed to ensure index exists: {str(e)}")
            raise

    def add_documents_sync(
        self,
        texts: List[str],
        metadatas: List[Dict[str, Any]],
        ids: Optional[List[str]] = None,
        namespace: Optional[str] = None
    ) -> List[str]:
        """
        Add documents to Pinecone using direct REST API (NO thread pools)

        This method bypasses Pinecone SDK entirely and uses direct HTTP requests
        to avoid thread pool creation in Celery workers.

        Args:
            texts: List of text chunks to embed and store
            metadatas: List of metadata dicts for each text chunk
            ids: Optional list of IDs for each document
            namespace: Optional namespace for multi-tenancy (e.g., organization_id)

        Returns:
            List[str]: List of document IDs

        Raises:
            Exception: If adding documents fails
        """
        try:
            import openai
            import requests
            import time

            if not ids:
                ids = [f"doc_{i}_{int(time.time())}" for i in range(len(texts))]

            # Use cached index host (set during init to avoid thread pool in describe_index)
            if not self.index_host:
                raise Exception("Index host not cached - cannot perform sync upsert")
            index_host = self.index_host

            # Process in small batches (REST API can handle this without threading)
            batch_size = 25  # Reasonable batch size for REST API
            all_doc_ids = []

            # Create OpenAI client without connection pooling
            client = openai.OpenAI(
                api_key=self.embedding_model,
                max_retries=2,
                timeout=60.0
            )

            # Create requests session (no connection pooling)
            session = requests.Session()
            session.headers.update({
                "Api-Key": self.api_key,
                "Content-Type": "application/json"
            })

            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i:i + batch_size]
                batch_metadatas = metadatas[i:i + batch_size]
                batch_ids = ids[i:i + batch_size]

                # Generate embeddings synchronously
                try:
                    response = client.embeddings.create(
                        input=batch_texts,
                        model="text-embedding-3-small"
                    )
                    embeddings = [item.embedding for item in response.data]
                except Exception as e:
                    logger.error(f"❌ Failed to generate embeddings: {str(e)}")
                    raise

                # Prepare vectors for upsert
                # Store all metadata fields at top level (as requested by user)
                vectors = []
                for vec_id, text, embedding, metadata in zip(batch_ids, batch_texts, embeddings, batch_metadatas):
                    # Build vector with all fields at top level
                    vector = {
                        "id": vec_id,
                        "values": embedding,
                        "text": text,
                        **metadata  # Spread all metadata fields at top level
                    }
                    vectors.append(vector)

                # Direct REST API upsert (no SDK, no thread pools)
                try:
                    url = f"https://{index_host}/vectors/upsert"
                    payload = {"vectors": vectors}
                    if namespace:
                        payload["namespace"] = namespace

                    resp = session.post(url, json=payload, timeout=30)
                    resp.raise_for_status()

                    all_doc_ids.extend(batch_ids)

                    if (i // batch_size + 1) % 10 == 0:
                        logger.info(f"✅ Processed {i + batch_size}/{len(texts)} documents")

                except Exception as e:
                    logger.error(f"❌ Pinecone REST upsert failed: {str(e)}")
                    raise

            session.close()
            logger.info(f"✅ Added {len(all_doc_ids)} documents to Pinecone (namespace: {namespace or 'default'})")
            return all_doc_ids

        except Exception as e:
            logger.error(f"❌ Failed to add documents to Pinecone: {str(e)}")
            raise Exception(f"Failed to add documents: {str(e)}")

    def add_documents(
        self,
        texts: List[str],
        metadatas: List[Dict[str, Any]],
        ids: Optional[List[str]] = None,
        namespace: Optional[str] = None
    ) -> List[str]:
        """
        Add documents to Pinecone - delegates to sync method for Celery compatibility
        """
        return self.add_documents_sync(texts, metadatas, ids, namespace)

    def similarity_search(
        self,
        query: str,
        k: int = 5,
        filter: Optional[Dict[str, Any]] = None,
        namespace: Optional[str] = None
    ) -> List[Document]:
        """
        Search for similar documents using semantic similarity

        Args:
            query: Query text
            k: Number of results to return
            filter: Optional metadata filter
            namespace: Optional namespace for multi-tenancy

        Returns:
            List[Document]: List of similar documents with metadata

        Raises:
            Exception: If search fails
        """
        try:
            # Create vector store with namespace if provided
            if namespace:
                vector_store = PineconeVectorStore(
                    index_name=self.index_name,
                    embedding=self.embeddings,
                    namespace=namespace
                )
            else:
                vector_store = self.vector_store

            if filter:
                results = vector_store.similarity_search(
                    query,
                    k=k,
                    filter=filter
                )
            else:
                results = vector_store.similarity_search(query, k=k)

            logger.info(f"✅ Found {len(results)} similar documents (namespace: {namespace or 'default'})")
            return results

        except Exception as e:
            logger.error(f"❌ Similarity search failed: {str(e)}")
            raise Exception(f"Similarity search failed: {str(e)}")

    def similarity_search_with_score(
        self,
        query: str,
        k: int = 5,
        filter: Optional[Dict[str, Any]] = None,
        namespace: Optional[str] = None
    ) -> List[tuple]:
        """
        Search for similar documents with relevance scores

        Args:
            query: Query text
            k: Number of results to return
            filter: Optional metadata filter
            namespace: Optional namespace for multi-tenancy

        Returns:
            List[tuple]: List of (Document, score) tuples

        Raises:
            Exception: If search fails
        """
        try:
            # Ensure k is a valid integer
            if k is None or k < 1:
                k = 5
                logger.warning(f"Invalid k value, using default: {k}")

            logger.debug(f"Similarity search: query='{query[:50]}...', k={k}, filter={filter}, namespace={namespace}")

            # Create vector store with namespace if provided
            if namespace:
                vector_store = PineconeVectorStore(
                    index_name=self.index_name,
                    embedding=self.embeddings,
                    namespace=namespace
                )
            else:
                vector_store = self.vector_store

            if filter:
                results = vector_store.similarity_search_with_score(
                    query,
                    k=k,
                    filter=filter
                )
            else:
                results = vector_store.similarity_search_with_score(query, k=k)

            logger.info(f"✅ Found {len(results)} similar documents with scores (namespace: {namespace or 'default'})")
            return results

        except Exception as e:
            logger.error(f"❌ Similarity search with score failed: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise Exception(f"Similarity search failed: {str(e)}")

    def delete_documents(
        self,
        ids: Optional[List[str]] = None,
        filter: Optional[Dict[str, Any]] = None,
        namespace: Optional[str] = None
    ) -> bool:
        """
        Delete documents from Pinecone by IDs or filter

        Args:
            ids: Optional list of document IDs to delete
            filter: Optional metadata filter for deletion
            namespace: Optional namespace for multi-tenancy

        Returns:
            bool: True if deletion was successful

        Raises:
            Exception: If deletion fails
        """
        try:
            index = self.pc.Index(self.index_name)

            if ids:
                if namespace:
                    index.delete(ids=ids, namespace=namespace)
                else:
                    index.delete(ids=ids)
                logger.info(f"✅ Deleted {len(ids)} documents from Pinecone (namespace: {namespace or 'default'})")
            elif filter:
                if namespace:
                    index.delete(filter=filter, namespace=namespace)
                else:
                    index.delete(filter=filter)
                logger.info(f"✅ Deleted documents matching filter from Pinecone (namespace: {namespace or 'default'})")
            else:
                raise ValueError("Either ids or filter must be provided")

            return True

        except Exception as e:
            logger.error(f"❌ Failed to delete documents from Pinecone: {str(e)}")
            raise Exception(f"Failed to delete documents: {str(e)}")

    def delete_by_knowledge_base(self, kb_name: str) -> bool:
        """
        Delete all documents belonging to a knowledge base

        Args:
            kb_name: Knowledge base name

        Returns:
            bool: True if deletion was successful
        """
        try:
            return self.delete_documents(filter={"kb_name": kb_name})
        except Exception as e:
            logger.error(f"❌ Failed to delete KB {kb_name}: {str(e)}")
            raise

    def delete_by_document_id(self, document_id: str) -> bool:
        """
        Delete all chunks belonging to a document

        Args:
            document_id: Document ID

        Returns:
            bool: True if deletion was successful
        """
        try:
            return self.delete_documents(filter={"document_id": document_id})
        except Exception as e:
            logger.error(f"❌ Failed to delete document {document_id}: {str(e)}")
            raise

    def get_retriever(self, k: int = 5, filter: Optional[Dict[str, Any]] = None):
        """
        Get a LangChain retriever for RAG applications

        Args:
            k: Number of documents to retrieve
            filter: Optional metadata filter

        Returns:
            VectorStoreRetriever: LangChain retriever object
        """
        search_kwargs = {"k": k}
        if filter:
            search_kwargs["filter"] = filter

        retriever = self.vector_store.as_retriever(
            search_kwargs=search_kwargs
        )

        logger.info(f"✅ Created retriever with k={k}")
        return retriever

    def update_metadata_by_filter(
        self,
        filter: Dict[str, Any],
        new_metadata: Dict[str, Any],
        namespace: Optional[str] = None
    ) -> int:
        """
        Update metadata for all vectors matching a filter

        Args:
            filter: Metadata filter to find vectors (e.g., {"folder_name": "old_name"})
            new_metadata: New metadata to set (e.g., {"folder_name": "new_name"})
            namespace: Optional namespace

        Returns:
            int: Number of vectors updated
        """
        try:
            index = self.pc.Index(self.index_name)

            # Query to get all matching vector IDs
            # We need to do a dummy query with high top_k to get IDs
            # Pinecone doesn't have a direct "list by filter" API, so we query with a zero vector

            logger.info(f"Querying Pinecone with filter: {filter}")

            # Create a dummy zero vector for querying
            dummy_vector = [0.0] * 1536  # text-embedding-3-small dimension

            # Query with filter to get matching IDs
            # Use very high top_k to get all matches
            query_response = index.query(
                vector=dummy_vector,
                filter=filter,
                top_k=10000,  # Pinecone max
                namespace=namespace,
                include_metadata=False  # We only need IDs
            )

            matches = query_response.get('matches', [])
            vector_ids = [match['id'] for match in matches]

            if not vector_ids:
                logger.warning(f"No vectors found matching filter: {filter}")
                return 0

            logger.info(f"Found {len(vector_ids)} vectors to update")

            # Update each vector's metadata
            updated_count = 0
            for vec_id in vector_ids:
                try:
                    index.update(
                        id=vec_id,
                        set_metadata=new_metadata,
                        namespace=namespace
                    )
                    updated_count += 1
                except Exception as e:
                    logger.error(f"Failed to update vector {vec_id}: {str(e)}")

            logger.info(f"✅ Updated metadata for {updated_count} vectors in Pinecone")
            return updated_count

        except Exception as e:
            logger.error(f"❌ Failed to update metadata by filter: {str(e)}")
            raise Exception(f"Failed to update metadata: {str(e)}")


def get_pinecone_client() -> PineconeClient:
    """
    Create a fresh PineconeClient instance (no caching to avoid multiprocessing issues in Celery)

    Returns:
        PineconeClient: Fresh client instance
    """
    return PineconeClient()
