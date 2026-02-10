"""
Document Ingestion Service
Orchestrates the complete ingestion pipeline:
1. Upload files to iDrive E2
2. Extract raw content
3. Store in MongoDB
4. Chunk content
5. Store chunks in Pinecone
"""

import io
import asyncio
from typing import List, Dict, Any
from datetime import datetime
from fastapi import UploadFile
from bson import ObjectId
from clients.idrivee2_client import get_idrivee2_client
from clients.mongodb_client import get_mongodb_client
from clients.pinecone_client import get_pinecone_client
from clients.chunker_client import (
    get_chunker_client,
    prepare_content_for_vectorization,
    validate_content_for_embeddings
)
from utils.file_utils import (
    extract_raw_data,
    validate_extracted_content,
    sanitize_filename,
    get_file_size_mb,
    get_file_extension
)
from app.logger import logger
from app.settings import settings
from app.thread_pool import get_thread_pool


class IngestionService:
    """Service for handling document ingestion pipeline"""

    # GLOBAL semaphore shared across ALL users and ALL instances
    # Allow up to MAX_THREAD_WORKERS concurrent ingestions to prevent thread exhaustion
    _global_ingestion_semaphore = asyncio.Semaphore(settings.MAX_THREAD_WORKERS)

    def __init__(self):
        """Initialize service with all required clients"""
        self.idrivee2_client = get_idrivee2_client()
        self.mongodb_client = get_mongodb_client()
        self.pinecone_client = get_pinecone_client()
        self.chunker_client = get_chunker_client()

        # Use global thread pool (shared across entire application)
        self.thread_pool = get_thread_pool()
        logger.info(f"🔧 IngestionService initialized - using GLOBAL semaphore (max {settings.MAX_THREAD_WORKERS} concurrent files)")

    async def ingest_documents(
        self,
        files: List[UploadFile],
        folder_name: str,
        user_id: str = None,
        organization_id: str = None,
        additional_metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Ingest multiple documents through the complete pipeline

        Args:
            files: List of uploaded files
            folder_name: Folder name for organization
            user_id: Optional user ID for tracking
            organization_id: Optional organization ID for tracking
            additional_metadata: Optional additional metadata to attach

        Returns:
            Dict with ingestion results and statistics
        """
        logger.info(f"🚀 Starting ingestion of {len(files)} files for folder: {folder_name}")

        results = {
            "folder_name": folder_name,
            "total_files": len(files),
            "successful_files": 0,
            "failed_files": 0,
            "documents": [],
            "errors": [],
            "statistics": {
                "total_chunks": 0,
                "total_size_mb": 0,
                "processing_time": None
            }
        }

        start_time = datetime.utcnow()

        # Process files with global concurrency limit (max MAX_THREAD_WORKERS at a time)
        logger.info(f"🚀 Processing {len(files)} files (max {settings.MAX_THREAD_WORKERS} concurrent)")

        async def process_file_with_error_handling(file):
            """Wrapper to handle errors for each file independently with concurrency control"""
            # GLOBAL SEMAPHORE: Max MAX_THREAD_WORKERS files can be processed across ALL users at the same time
            async with IngestionService._global_ingestion_semaphore:
                logger.info(f"🔒 Acquired semaphore slot for {file.filename} - processing now")
                try:
                    result = await self._process_single_document(
                        file=file,
                        folder_name=folder_name,
                        user_id=user_id,
                        organization_id=organization_id,
                        additional_metadata=additional_metadata
                    )
                    logger.info(f"✅ Successfully processed: {file.filename}")
                    return {"success": True, "result": result, "filename": file.filename}
                except Exception as e:
                    logger.error(f"❌ Failed to process {file.filename}: {str(e)}")
                    return {"success": False, "error": str(e), "filename": file.filename}
                finally:
                    logger.info(f"🔓 Released semaphore slot for {file.filename}")

        # Submit all files - global semaphore limits concurrency to MAX_THREAD_WORKERS
        file_results = await asyncio.gather(*[process_file_with_error_handling(file) for file in files])

        # Aggregate results
        for file_result in file_results:
            if file_result["success"]:
                results["successful_files"] += 1
                results["documents"].append(file_result["result"])
                results["statistics"]["total_chunks"] += file_result["result"].get("total_chunks", 0)
                results["statistics"]["total_size_mb"] += file_result["result"].get("file_size_mb", 0)
            else:
                results["failed_files"] += 1
                results["errors"].append({
                    "file_name": file_result["filename"],
                    "error": file_result["error"]
                })

        # Calculate processing time
        end_time = datetime.utcnow()
        processing_time = (end_time - start_time).total_seconds()
        results["statistics"]["processing_time"] = processing_time

        logger.info(
            f"🎉 Ingestion completed: {results['successful_files']}/{results['total_files']} successful, "
            f"{results['statistics']['total_chunks']} chunks, "
            f"{processing_time:.2f}s"
        )

        return results

    async def _process_single_document(
        self,
        file: UploadFile,
        folder_name: str,
        user_id: str = None,
        organization_id: str = None,
        additional_metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Process a single document through the complete pipeline

        Args:
            file: Uploaded file
            folder_name: Folder name for organization
            user_id: Optional user ID
            organization_id: Optional organization ID
            additional_metadata: Optional additional metadata

        Returns:
            Dict with processing results
        """
        logger.info(f"📄 Processing document: {file.filename}")

        # Read file content
        file_content = await file.read()
        file_size_mb = get_file_size_mb(file_content)

        # Prepare for parallel operations
        safe_filename = sanitize_filename(file.filename)
        # Include organization_id in file_key for multi-tenant isolation
        if organization_id:
            file_key = f"{organization_id}/{folder_name}/{safe_filename}"
        else:
            file_key = f"{folder_name}/{safe_filename}"  # Backwards compatibility

        # STEP 0: Create document record with status="processing" FIRST
        logger.info(f"📝 Creating document record with status='processing': {file.filename}")
        document_id = await self._create_document_with_status(
            file_name=file.filename,
            folder_name=folder_name,
            file_key=file_key,
            file_size_mb=file_size_mb,
            user_id=user_id,
            organization_id=organization_id,
            additional_metadata=additional_metadata
        )
        logger.info(f"✅ Document record created: {document_id}")

        try:
            # Step 1 & 2: Run in parallel - Upload to iDrive E2 + Extract content
            logger.info(f"🚀 Starting parallel processing: Upload to E2 + Content extraction for {file.filename}")

            # Update status to indicate we're uploading + extracting
            await self._update_document_status(
                document_id=document_id,
                stage="uploading_extracting",
                stage_description="Uploading to storage and extracting content"
            )

            # Upload file (synchronous - no parallelism)
            await self.idrivee2_client.upload_file(
                file_obj=io.BytesIO(file_content),
                object_name=file_key,
                content_type=file.content_type
            )

            # Extract content (synchronous - no thread pool to avoid thread exhaustion)
            raw_content = extract_raw_data(file_content, file.filename, folder_name)

            logger.info(f"✅ Sequential processing complete for {file.filename}")

            # Check if this is a video file (special handling)
            is_video = isinstance(raw_content, dict) and raw_content.get('type') == 'video'

            if is_video:
                # For videos: extract components
                combined_text = raw_content['combined_text']
                video_chunks = raw_content['chunks']
                logger.info(f"🎬 Video extracted: {len(video_chunks)} scene chunks created")

                # Validate video chunks exist
                if not combined_text or not video_chunks:
                    raise ValueError(f"Video processing failed for: {file.filename}")

                content_for_mongodb = combined_text
            else:
                # Normal files: validate and check token limits
                if not validate_extracted_content(raw_content):
                    raise ValueError(f"Extracted content is invalid or empty for: {file.filename}")

                # Validate content for embeddings (synchronous)
                validation_result = validate_content_for_embeddings(raw_content)
                logger.info(
                    f"📊 Content validation: {validation_result['token_count']} tokens, "
                    f"needs_chunking={validation_result['needs_chunking']}"
                )

                content_for_mongodb = raw_content

            # Step 3: Update MongoDB with extracted content
            logger.info(f"💾 Updating document with extracted content: {file.filename}")
            await self._update_document_content(
            document_id=document_id,
            raw_content=content_for_mongodb,
            stage="content_extracted",
            stage_description="Content extraction completed"
            )
            logger.info(f"✅ MongoDB content updated. Document ID: {document_id}")

            # Step 4 & 5: Chunking and Pinecone storage
            total_chunks = 0

            if is_video:
                # For videos: use pre-made scene chunks directly (skip semantic chunking)
                logger.info(f"📦 Storing video scene chunks in Pinecone: {file.filename}")

                # Update status to embedding
                await self._update_document_status(
                document_id=document_id,
                stage="embedding",
                stage_description=f"Creating embeddings for {len(video_chunks)} video chunks",
                progress_current=0,
                progress_total=len(video_chunks)
                )

                # Prepare metadata and texts for Pinecone
                texts = []
                metadatas = []
                ids = []

                for chunk in video_chunks:
                    texts.append(chunk['blended_text'])

                    # Build metadata, excluding keyframe_file_key if None (Pinecone rejects null values)
                    metadata = {
                        "document_id": document_id,
                        "file_name": file.filename,
                        "folder_name": folder_name,
                        "file_key": file_key,
                        "user_id": user_id,
                        "video_id": chunk['video_id'],
                        "video_name": chunk['video_name'],
                        "clip_start": chunk['clip_start'],
                        "clip_end": chunk['clip_end'],
                        "duration": chunk['duration'],
                        "key_frame_timestamp": chunk['key_frame_timestamp'],
                        "scene_id": chunk.get('chunk_id'),
                        **(additional_metadata or {})
                    }

                    # Only include keyframe_file_key if it's not None
                    if chunk.get('keyframe_file_key') is not None:
                        metadata["keyframe_file_key"] = chunk['keyframe_file_key']

                    metadatas.append(metadata)
                    ids.append(f"{document_id}_{chunk['chunk_id']}")

                # Add to Pinecone in thread pool
                logger.info(f"🔄 Starting Pinecone storage for {len(texts)} video chunks...")
                logger.info(f"   - Namespace: {organization_id}")
                logger.info(f"   - First text preview: {texts[0][:100]}..." if texts else "   - No texts")

                # Add to Pinecone (synchronous)
                self.pinecone_client.add_documents(
                    texts=texts,
                    metadatas=metadatas,
                    ids=ids,
                    namespace=organization_id
                )

                total_chunks = len(video_chunks)
                logger.info(f"✅ Stored {total_chunks} video scene chunks in Pinecone for: {file.filename}")

            else:
                # Normal files: do semantic chunking
                logger.info(f"📦 Preparing content for vectorization: {file.filename}")
                base_metadata = {
                    "document_id": document_id,
                    "file_name": file.filename,
                    "folder_name": folder_name,
                    "file_key": file_key,
                    "user_id": user_id,
                    **(additional_metadata or {})
                }

                # This handles token-based pre-chunking if content > 200k tokens (synchronous)
                prepared_documents = prepare_content_for_vectorization(content=raw_content, metadata=base_metadata)

                # Apply semantic chunking to each prepared document and store in Pinecone
                logger.info(
                    f"✂️ Semantic chunking and storing in Pinecone: {file.filename} "
                    f"({len(prepared_documents)} pre-chunk{'s' if len(prepared_documents) > 1 else ''})"
                )

                for idx, pre_chunk_doc in enumerate(prepared_documents, 1):
                    pre_chunk_content = pre_chunk_doc["content"]
                    pre_chunk_metadata = pre_chunk_doc["metadata"]

                    logger.info(
                        f"📝 Processing pre-chunk {idx}/{len(prepared_documents)} "
                        f"for {file.filename}..."
                    )

                    # Apply semantic chunking to this pre-chunk (synchronous)
                    chunks = self.chunker_client.chunk_with_metadata(
                        text=pre_chunk_content,
                        base_metadata=pre_chunk_metadata,
                        chunker_type="default"
                    )

                    # Store chunks in Pinecone (use organization_id as namespace)
                    texts = [chunk["text"] for chunk in chunks]
                    metadatas = [chunk["metadata"] for chunk in chunks]

                    # Generate unique IDs for chunks
                    pre_chunk_index = pre_chunk_metadata.get("pre_chunk_index", 0)
                    ids = [
                        f"{document_id}_pre{pre_chunk_index}_chunk{i}"
                        for i in range(len(chunks))
                    ]

                    # Add to Pinecone (synchronous)
                    self.pinecone_client.add_documents(
                        texts=texts,
                        metadatas=metadatas,
                        ids=ids,
                        namespace=organization_id
                    )

                    total_chunks += len(chunks)
                    logger.info(
                        f"✅ Completed pre-chunk {idx}/{len(prepared_documents)}: "
                        f"{len(chunks)} chunks stored in Pinecone"
                    )

                logger.info(f"✅ Stored {total_chunks} chunks in Pinecone for: {file.filename}")

            # Mark as completed
            await self._update_document_status(
            document_id=document_id,
            status="completed",
            stage="completed",
            stage_description=f"Successfully processed {total_chunks} chunks",
            completed_at=datetime.utcnow()
            )
            logger.info(f"✅ Document marked as completed: {document_id}")

            # Return results
            result = {
            "document_id": document_id,
            "file_name": file.filename,
            "folder_name": folder_name,
            "file_key": file_key,
            "file_size_mb": file_size_mb,
            "total_chunks": total_chunks
            }

            # Add token_count only for non-video files
            if not is_video:
                result["token_count"] = validation_result['token_count']

            return result

        except Exception as e:
            # Mark document as failed
            logger.error(f"❌ Processing failed for {file.filename}: {str(e)}")
            await self._update_document_status(
                document_id=document_id,
                status="failed",
                stage="failed",
                stage_description=f"Processing failed: {str(e)}",
                error=str(e),
                failed_at=datetime.utcnow()
            )
            raise  # Re-raise the exception

    async def _process_single_document_with_existing_id(
        self,
        document_id: str,
        file: UploadFile,
        folder_name: str,
        user_id: str = None,
        organization_id: str = None,
        additional_metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Process a single document using an EXISTING document ID (document already created)

        This is used when documents are pre-created in the upload endpoint.

        Args:
            document_id: Existing document ID from MongoDB
            file: Uploaded file
            folder_name: Folder name for organization
            user_id: Optional user ID
            organization_id: Optional organization ID
            additional_metadata: Optional additional metadata

        Returns:
            Dict with processing results
        """
        logger.info(f"📄 Processing document with existing ID {document_id}: {file.filename}")

        # Read file content
        file_content = await file.read()
        file_size_mb = get_file_size_mb(file_content)

        # Prepare for parallel operations
        safe_filename = sanitize_filename(file.filename)
        # Include organization_id in file_key for multi-tenant isolation
        if organization_id:
            file_key = f"{organization_id}/{folder_name}/{safe_filename}"
        else:
            file_key = f"{folder_name}/{safe_filename}"  # Backwards compatibility

        try:
            # Step 1 & 2: Run in parallel - Upload to iDrive E2 + Extract content
            logger.info(f"🚀 Starting parallel processing: Upload to E2 + Content extraction for {file.filename}")

            # Update status to indicate we're uploading + extracting
            await self._update_document_status(
                document_id=document_id,
                stage="uploading_extracting",
                stage_description="Uploading to storage and extracting content"
            )

            # Upload file (synchronous - no parallelism)
            await self.idrivee2_client.upload_file(
                file_obj=io.BytesIO(file_content),
                object_name=file_key,
                content_type=file.content_type
            )

            # Extract content (synchronous - no thread pool to avoid thread exhaustion)
            raw_content = extract_raw_data(file_content, file.filename, folder_name)

            logger.info(f"✅ Sequential processing complete for {file.filename}")

            # Check if this is a video file (special handling)
            is_video = isinstance(raw_content, dict) and raw_content.get('type') == 'video'

            if is_video:
                # For videos: extract components
                combined_text = raw_content['combined_text']
                video_chunks = raw_content['chunks']
                logger.info(f"🎬 Video extracted: {len(video_chunks)} scene chunks created")

                # Validate video chunks exist
                if not combined_text or not video_chunks:
                    raise ValueError(f"Video processing failed for: {file.filename}")

                content_for_mongodb = combined_text
            else:
                # Normal files: validate and check token limits
                if not validate_extracted_content(raw_content):
                    raise ValueError(f"Extracted content is invalid or empty for: {file.filename}")

                # Validate content for embeddings (synchronous)
                validation_result = validate_content_for_embeddings(raw_content)
                logger.info(
                    f"📊 Content validation: {validation_result['token_count']} tokens, "
                    f"needs_chunking={validation_result['needs_chunking']}"
                )

                content_for_mongodb = raw_content

            # Step 3: Update MongoDB with extracted content
            logger.info(f"💾 Updating document with extracted content: {file.filename}")
            await self._update_document_content(
                document_id=document_id,
                raw_content=content_for_mongodb,
                stage="content_extracted",
                stage_description="Content extraction completed"
            )
            logger.info(f"✅ MongoDB content updated. Document ID: {document_id}")

            # Step 4 & 5: Chunking and Pinecone storage
            total_chunks = 0

            if is_video:
                # For videos: use pre-made scene chunks directly (skip semantic chunking)
                logger.info(f"📦 Storing video scene chunks in Pinecone: {file.filename}")

                # Update status to embedding
                await self._update_document_status(
                    document_id=document_id,
                    stage="embedding",
                    stage_description=f"Creating embeddings for {len(video_chunks)} video chunks",
                    progress_current=0,
                    progress_total=len(video_chunks)
                )

                # Prepare metadata and texts for Pinecone
                texts = []
                metadatas = []
                ids = []

                for chunk in video_chunks:
                    texts.append(chunk['blended_text'])

                    # Build metadata, excluding keyframe_file_key if None (Pinecone rejects null values)
                    metadata = {
                        "document_id": document_id,
                        "file_name": file.filename,
                        "folder_name": folder_name,
                        "file_key": file_key,
                        "user_id": user_id,
                        "video_id": chunk['video_id'],
                        "video_name": chunk['video_name'],
                        "clip_start": chunk['clip_start'],
                        "clip_end": chunk['clip_end'],
                        "duration": chunk['duration'],
                        "key_frame_timestamp": chunk['key_frame_timestamp'],
                        "scene_id": chunk.get('chunk_id'),
                        **(additional_metadata or {})
                    }

                    # Only include keyframe_file_key if it's not None
                    if chunk.get('keyframe_file_key') is not None:
                        metadata["keyframe_file_key"] = chunk['keyframe_file_key']

                    metadatas.append(metadata)
                    ids.append(f"{document_id}_{chunk['chunk_id']}")

                # Add to Pinecone in thread pool
                logger.info(f"🔄 Starting Pinecone storage for {len(texts)} video chunks...")
                logger.info(f"   - Namespace: {organization_id}")

                # Add to Pinecone (synchronous)
                self.pinecone_client.add_documents(
                    texts=texts,
                    metadatas=metadatas,
                    ids=ids,
                    namespace=organization_id
                )

                total_chunks = len(video_chunks)
                logger.info(f"✅ Stored {total_chunks} video scene chunks in Pinecone for: {file.filename}")

            else:
                # Normal files: do semantic chunking
                logger.info(f"📦 Preparing content for vectorization: {file.filename}")
                base_metadata = {
                    "document_id": document_id,
                    "file_name": file.filename,
                    "folder_name": folder_name,
                    "file_key": file_key,
                    "user_id": user_id,
                    **(additional_metadata or {})
                }

                # This handles token-based pre-chunking if content > 200k tokens (synchronous)
                prepared_documents = prepare_content_for_vectorization(content=raw_content, metadata=base_metadata)

                # Apply semantic chunking
                logger.info(
                    f"✂️ Semantic chunking and storing in Pinecone: {file.filename} "
                    f"({len(prepared_documents)} pre-chunk{'s' if len(prepared_documents) > 1 else ''})"
                )

                for idx, pre_chunk_doc in enumerate(prepared_documents, 1):
                    pre_chunk_content = pre_chunk_doc["content"]
                    pre_chunk_metadata = pre_chunk_doc["metadata"]

                    logger.info(
                        f"📝 Processing pre-chunk {idx}/{len(prepared_documents)} "
                        f"for {file.filename}..."
                    )

                    # Apply semantic chunking to this pre-chunk (synchronous)
                    chunks = self.chunker_client.chunk_with_metadata(
                        text=pre_chunk_content,
                        base_metadata=pre_chunk_metadata,
                        chunker_type="default"
                    )

                    # Store chunks in Pinecone
                    texts = [chunk["text"] for chunk in chunks]
                    metadatas = [chunk["metadata"] for chunk in chunks]

                    # Generate unique IDs for chunks
                    pre_chunk_index = pre_chunk_metadata.get("pre_chunk_index", 0)
                    ids = [
                        f"{document_id}_pre{pre_chunk_index}_chunk{i}"
                        for i in range(len(chunks))
                    ]

                    # Add to Pinecone (synchronous)
                    self.pinecone_client.add_documents(
                        texts=texts,
                        metadatas=metadatas,
                        ids=ids,
                        namespace=organization_id
                    )

                    total_chunks += len(chunks)
                    logger.info(
                        f"✅ Completed pre-chunk {idx}/{len(prepared_documents)}: "
                        f"{len(chunks)} chunks stored in Pinecone"
                    )

                logger.info(f"✅ Stored {total_chunks} chunks in Pinecone for: {file.filename}")

            # Mark as completed
            await self._update_document_status(
                document_id=document_id,
                status="completed",
                stage="completed",
                stage_description=f"Successfully processed {total_chunks} chunks",
                completed_at=datetime.utcnow()
            )
            logger.info(f"✅ Document marked as completed: {document_id}")

            # Return results
            result = {
                "document_id": document_id,
                "file_name": file.filename,
                "folder_name": folder_name,
                "file_key": file_key,
                "file_size_mb": file_size_mb,
                "total_chunks": total_chunks
            }

            # Add token_count only for non-video files
            if not is_video:
                result["token_count"] = validation_result['token_count']

            return result

        except Exception as e:
            # Mark document as failed
            logger.error(f"❌ Processing failed for {file.filename}: {str(e)}")
            await self._update_document_status(
                document_id=document_id,
                status="failed",
                stage="failed",
                stage_description=f"Processing failed: {str(e)}",
                error=str(e),
                failed_at=datetime.utcnow()
            )
            raise  # Re-raise the exception

    async def _create_document_with_status(
        self,
        file_name: str,
        folder_name: str,
        file_key: str,
        file_size_mb: float,
        user_id: str = None,
        organization_id: str = None,
        additional_metadata: Dict[str, Any] = None
    ) -> str:
        """
        Create document record with status="processing"

        Returns:
            Document ID (string)
        """
        # Convert user_id and organization_id to ObjectId
        user_object_id = ObjectId(user_id) if user_id else None
        organization_object_id = ObjectId(organization_id) if organization_id else None

        document = {
            "file_name": file_name,
            "folder_name": folder_name,
            "raw_content": None,  # Will be updated later
            "file_key": file_key,
            "file_size_mb": file_size_mb,
            "file_extension": get_file_extension(file_name),
            "user_id": user_object_id,
            "organization_id": organization_object_id,
            "status": "processing",
            "processing_stage": "initializing",
            "processing_stage_description": "Starting ingestion",
            "processing_progress": None,
            "error": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "completed_at": None,
            "failed_at": None,
            **(additional_metadata or {})
        }

        result = await self.mongodb_client.async_insert_document(
            collection="documents",
            document=document
        )

        return str(result)

    async def _update_document_status(
        self,
        document_id: str,
        status: str = None,
        stage: str = None,
        stage_description: str = None,
        progress_current: int = None,
        progress_total: int = None,
        error: str = None,
        completed_at: datetime = None,
        failed_at: datetime = None
    ):
        """
        Update document processing status

        Args:
            document_id: Document ID
            status: Overall status (processing/completed/failed)
            stage: Current processing stage
            stage_description: Description of current stage
            progress_current: Current progress count
            progress_total: Total items to process
            error: Error message if failed
            completed_at: Completion timestamp
            failed_at: Failure timestamp
        """
        update_fields = {
            "updated_at": datetime.utcnow()
        }

        if status is not None:
            update_fields["status"] = status

        if stage is not None:
            update_fields["processing_stage"] = stage

        if stage_description is not None:
            update_fields["processing_stage_description"] = stage_description

        if progress_current is not None or progress_total is not None:
            progress = {}
            if progress_current is not None:
                progress["current"] = progress_current
            if progress_total is not None:
                progress["total"] = progress_total
            if progress_current is not None and progress_total is not None and progress_total > 0:
                progress["percentage"] = round((progress_current / progress_total) * 100, 2)
            update_fields["processing_progress"] = progress

        if error is not None:
            update_fields["error"] = error

        if completed_at is not None:
            update_fields["completed_at"] = completed_at

        if failed_at is not None:
            update_fields["failed_at"] = failed_at

        await self.mongodb_client.async_update_document(
            collection="documents",
            query={"_id": ObjectId(document_id)},
            update={"$set": update_fields}
        )

    async def _update_document_content(
        self,
        document_id: str,
        raw_content: str,
        stage: str = None,
        stage_description: str = None
    ):
        """
        Update document with extracted content and optionally update status

        Args:
            document_id: Document ID
            raw_content: Extracted content
            stage: Current processing stage
            stage_description: Description of current stage
        """
        update_fields = {
            "raw_content": raw_content,
            "updated_at": datetime.utcnow()
        }

        if stage is not None:
            update_fields["processing_stage"] = stage

        if stage_description is not None:
            update_fields["processing_stage_description"] = stage_description

        await self.mongodb_client.async_update_document(
            collection="documents",
            query={"_id": ObjectId(document_id)},
            update={"$set": update_fields}
        )

    async def _store_document_in_mongodb(
        self,
        file_name: str,
        folder_name: str,
        raw_content: str,
        file_key: str,
        file_size_mb: float,
        user_id: str = None,
        organization_id: str = None,
        additional_metadata: Dict[str, Any] = None
    ) -> str:
        """
        Store document in MongoDB

        Args:
            file_name: Original file name
            folder_name: Folder name
            raw_content: Extracted raw content
            file_key: iDrive E2 object key/path (not URL, since bucket is private)
            file_size_mb: File size in MB
            user_id: Optional user ID
            organization_id: Optional organization ID
            additional_metadata: Optional additional metadata

        Returns:
            Document ID
        """
        # Convert user_id and organization_id to ObjectId
        user_object_id = ObjectId(user_id) if user_id else None
        organization_object_id = ObjectId(organization_id) if organization_id else None

        document = {
            "file_name": file_name,
            "folder_name": folder_name,
            "raw_content": raw_content,
            "file_key": file_key,
            "file_size_mb": file_size_mb,
            "file_extension": get_file_extension(file_name),
            "user_id": user_object_id,
            "organization_id": organization_object_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            **(additional_metadata or {})
        }

        result = await self.mongodb_client.async_insert_document(
            collection="documents",
            document=document
        )

        return str(result)

    async def delete_document(
        self,
        document_id: str,
        delete_from_storage: bool = True
    ) -> Dict[str, Any]:
        """
        Delete document and its chunks from all systems

        Args:
            document_id: MongoDB document ID (string that will be converted to ObjectId)
            delete_from_storage: Whether to delete from iDrive E2

        Returns:
            Dict with deletion results
        """
        logger.info(f"🗑️ Deleting document: {document_id}")

        # Convert document_id to ObjectId for MongoDB query
        doc_object_id = ObjectId(document_id)

        # Get document from MongoDB (async)
        document = await self.mongodb_client.async_find_document(
            collection="documents",
            query={"_id": doc_object_id}
        )

        if not document:
            raise ValueError(f"Document not found: {document_id}")

        # Delete from iDrive E2 if requested (async)
        if delete_from_storage and document.get("file_key"):
            try:
                await self.idrivee2_client.delete_file(document["file_key"])
                logger.info(f"✅ Deleted from iDrive E2: {document['file_key']}")
            except Exception as e:
                logger.warning(f"Failed to delete from iDrive E2: {str(e)}")

        # Delete chunks from Pinecone (use organization_id as namespace)
        try:
            # organization_id is stored as ObjectId in MongoDB, convert to string for Pinecone namespace
            organization_id = str(document.get("organization_id")) if document.get("organization_id") else None
            # Delete all chunks for this document (synchronous)
            self.pinecone_client.delete_documents(
                filter={"document_id": document_id},
                namespace=organization_id
            )
            logger.info(f"✅ Deleted chunks from Pinecone for document: {document_id} (namespace: {organization_id})")
        except Exception as e:
            logger.warning(f"Failed to delete from Pinecone: {str(e)}")

        # Delete from MongoDB (async)
        await self.mongodb_client.async_delete_document(
            collection="documents",
            query={"_id": doc_object_id}
        )

        logger.info(f"✅ Document deleted: {document_id}")

        return {
            "document_id": document_id,
            "deleted": True
        }

    async def _convert_file_key_to_url(self, document: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert file_key to presigned URL in document (async)

        Args:
            document: Document dict with file_key

        Returns:
            Document dict with file_url instead of file_key
        """
        if document and document.get("file_key"):
            try:
                # Generate presigned URL (async, expiration from settings, default 7 days)
                file_url = await self.idrivee2_client.generate_presigned_url(
                    object_name=document["file_key"],
                    expiration=settings.PRESIGNED_URL_EXPIRATION
                )
                # Replace file_key with file_url
                document["file_url"] = file_url
                # Remove file_key from response
                document.pop("file_key", None)
            except Exception as e:
                logger.warning(f"Failed to generate presigned URL for {document.get('file_key')}: {str(e)}")
                # Keep file_key if URL generation fails
        return document

    async def get_document(self, document_id: str) -> Dict[str, Any]:
        """
        Get document from MongoDB and convert file_key to presigned URL (async)

        Args:
            document_id: MongoDB document ID (string that will be converted to ObjectId)

        Returns:
            Document dict with fresh presigned URL
        """
        # Convert document_id string to ObjectId for MongoDB query (async)
        document = await self.mongodb_client.async_find_document(
            collection="documents",
            query={"_id": ObjectId(document_id)}
        )

        if document:
            # Convert ObjectId to string for JSON serialization
            document["_id"] = str(document["_id"])
            if document.get("user_id"):
                document["user_id"] = str(document["user_id"])
            if document.get("organization_id"):
                document["organization_id"] = str(document["organization_id"])

            document = await self._convert_file_key_to_url(document)

        return document

    async def list_documents(
        self,
        folder_name: str = None,
        user_id: str = None,
        organization_id: str = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """
        List documents from MongoDB with optional filters and convert file_keys to presigned URLs (async)

        Args:
            folder_name: Optional folder name filter (string)
            user_id: Optional user ID filter (string that will be converted to ObjectId)
            organization_id: Optional organization ID filter (string that will be converted to ObjectId)
            limit: Maximum number of documents to return
            skip: Number of documents to skip

        Returns:
            List of documents with fresh presigned URLs
        """
        filter_query = {}

        if folder_name:
            filter_query["folder_name"] = folder_name

        if user_id:
            filter_query["user_id"] = ObjectId(user_id)

        if organization_id:
            filter_query["organization_id"] = ObjectId(organization_id)

        documents = await self.mongodb_client.async_find_documents(
            collection="documents",
            query=filter_query,
            limit=limit,
            skip=skip,
            projection={
                "raw_content": 0,
                "file_size_mb": 0,
                "file_extension": 0
            }
        )

        # Convert ObjectIds to strings and file_key to presigned URL for each document (async)
        documents_with_urls = []
        for doc in documents:
            # Convert ObjectId to string for JSON serialization
            doc["_id"] = str(doc["_id"])
            if doc.get("user_id"):
                doc["user_id"] = str(doc["user_id"])
            if doc.get("organization_id"):
                doc["organization_id"] = str(doc["organization_id"])

            doc = await self._convert_file_key_to_url(doc)
            documents_with_urls.append(doc)

        return documents_with_urls

    async def list_folders(
        self,
        user_id: str = None,
        organization_id: str = None
    ) -> List[str]:
        """
        Get list of unique folder names from documents collection

        Args:
            user_id: Optional user ID filter
            organization_id: Optional organization ID filter

        Returns:
            List of unique folder names
        """
        filter_query = {}

        if user_id:
            filter_query["user_id"] = ObjectId(user_id)

        if organization_id:
            filter_query["organization_id"] = ObjectId(organization_id)

        # Get distinct folder names from MongoDB
        folders = await self.mongodb_client.async_distinct(
            collection="documents",
            field="folder_name",
            query=filter_query
        )

        # Filter out None/empty values and sort
        folders = [f for f in folders if f]
        folders.sort()

        logger.info(f"📁 Found {len(folders)} folders")
        return folders

    async def delete_folder(
        self,
        folder_name: str,
        user_id: str = None,
        organization_id: str = None,
        delete_from_storage: bool = True
    ) -> Dict[str, Any]:
        """
        Delete all documents in a folder from ALL systems:
        - MongoDB (document metadata)
        - Pinecone (vector chunks)
        - iDrive E2 (file storage)

        Args:
            folder_name: Folder name to delete
            user_id: Optional user ID filter (only delete user's docs)
            organization_id: Optional organization ID filter
            delete_from_storage: Whether to delete from iDrive E2

        Returns:
            Dict with deletion results
        """
        logger.info(f"🗑️ Deleting folder '{folder_name}' from ALL systems (MongoDB + Pinecone + iDrive E2)")

        # Build query for documents in this folder
        filter_query = {"folder_name": folder_name}

        if user_id:
            filter_query["user_id"] = ObjectId(user_id)

        if organization_id:
            filter_query["organization_id"] = ObjectId(organization_id)

        # Get all documents in folder
        documents = await self.mongodb_client.async_find_documents(
            collection="documents",
            query=filter_query
        )

        if not documents:
            logger.warning(f"No documents found in folder: {folder_name}")
            return {
                "folder_name": folder_name,
                "deleted_count": 0,
                "deleted_documents": []
            }

        deleted_count = 0
        deleted_docs = []
        errors = []

        # Delete each document (this handles MongoDB, Pinecone, and iDrive E2)
        for doc in documents:
            try:
                doc_id = str(doc["_id"])
                await self.delete_document(
                    document_id=doc_id,
                    delete_from_storage=delete_from_storage
                )
                deleted_count += 1
                deleted_docs.append(doc_id)
            except Exception as e:
                logger.error(f"❌ Failed to delete document {doc.get('_id')}: {str(e)}")
                errors.append({
                    "document_id": str(doc.get("_id")),
                    "error": str(e)
                })

        logger.info(f"✅ Folder '{folder_name}' deleted: {deleted_count} documents removed from all systems")

        return {
            "folder_name": folder_name,
            "deleted_count": deleted_count,
            "deleted_documents": deleted_docs,
            "errors": errors if errors else None
        }

    async def rename_folder(
        self,
        old_folder_name: str,
        new_folder_name: str,
        user_id: str = None,
        organization_id: str = None
    ) -> Dict[str, Any]:
        """
        Rename a folder across ALL systems:
        - MongoDB (document metadata)
        - Pinecone (chunk metadata - folder_name field)
        - iDrive E2 (no change needed - uses file_key, not folder_name)

        Args:
            old_folder_name: Current folder name
            new_folder_name: New folder name
            user_id: Optional user ID filter (only rename user's docs)
            organization_id: Optional organization ID filter

        Returns:
            Dict with rename results
        """
        logger.info(f"📝 Renaming folder '{old_folder_name}' → '{new_folder_name}' across ALL systems")

        # Build query for documents in old folder
        filter_query = {"folder_name": old_folder_name}

        if user_id:
            filter_query["user_id"] = ObjectId(user_id)

        if organization_id:
            filter_query["organization_id"] = ObjectId(organization_id)

        # Get document count to verify
        documents = await self.mongodb_client.async_find_documents(
            collection="documents",
            query=filter_query,
            projection={"_id": 1}
        )

        if not documents:
            logger.warning(f"No documents found in folder: {old_folder_name}")
            return {
                "old_folder_name": old_folder_name,
                "new_folder_name": new_folder_name,
                "updated_count": 0
            }

        # 1. Update MongoDB documents
        mongo_result = await self.mongodb_client.async_update_documents(
            collection="documents",
            query=filter_query,
            update={"$set": {"folder_name": new_folder_name}}
        )
        mongo_updated = mongo_result.get("modified_count", 0)
        logger.info(f"  ✅ MongoDB: Updated {mongo_updated} documents")

        # 2. Update Pinecone chunks metadata
        # Filter by folder_name and update all matching vectors
        pinecone_filter = {"folder_name": old_folder_name}

        if user_id:
            pinecone_filter["user_id"] = user_id

        org_namespace = str(organization_id) if organization_id else None

        try:
            # Update Pinecone metadata (synchronous)
            pinecone_updated = self.pinecone_client.update_metadata_by_filter(
                filter=pinecone_filter,
                new_metadata={"folder_name": new_folder_name},
                namespace=org_namespace
            )
            logger.info(f"  ✅ Pinecone: Updated {pinecone_updated} vector chunks")
        except Exception as e:
            logger.error(f"  ❌ Pinecone update failed: {str(e)}")
            pinecone_updated = 0

        # 3. iDrive E2 - No action needed (uses file_key, not folder_name)
        logger.info(f"  ✅ iDrive E2: No action needed (uses file_key)")

        logger.info(f"✅ Folder renamed successfully across all systems")

        return {
            "old_folder_name": old_folder_name,
            "new_folder_name": new_folder_name,
            "mongodb_updated": mongo_updated,
            "pinecone_updated": pinecone_updated,
            "idrive_updated": "N/A (uses file_key)"
        }


# Singleton instance
_ingestion_service = None


def get_ingestion_service() -> IngestionService:
    """
    Get or create IngestionService singleton instance

    Returns:
        IngestionService instance
    """
    global _ingestion_service

    if _ingestion_service is None:
        _ingestion_service = IngestionService()

    return _ingestion_service
