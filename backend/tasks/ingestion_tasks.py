"""
Document Ingestion Celery Tasks
Processes documents using existing MongoDB document IDs
"""
import gc
import base64
from typing import Dict, Any, List
from app.worker import celery_app
from services.ingestion_service import IngestionService
from app.logger import logger


@celery_app.task
def process_document_ids_task(
    documents_data: List[Dict[str, Any]],
    folder_name: str,
    user_id: str = None,
    organization_id: str = None
) -> Dict[str, Any]:
    """
    Main Celery task - creates individual tasks for each document

    Args:
        documents_data: List of dicts with:
            - document_id: MongoDB document ID (already created)
            - content_b64: Base64-encoded file content
            - filename: Original filename
            - content_type: MIME type
        folder_name: Folder name
        user_id: User ID
        organization_id: Organization ID

    Returns:
        Dict with task IDs
    """
    logger.info(f"📦 Main task: Distributing {len(documents_data)} documents to workers")

    task_info = []

    # Create individual Celery task for each document
    for doc_data in documents_data:
        try:
            # Launch individual worker task
            task = process_single_document_task.delay(
                document_id=doc_data["document_id"],
                file_key=doc_data["file_key"],
                content_b64=doc_data["content_b64"],
                filename=doc_data["filename"],
                content_type=doc_data["content_type"],
                folder_name=folder_name,
                user_id=user_id,
                organization_id=organization_id
            )

            task_info.append({
                "document_id": doc_data["document_id"],
                "filename": doc_data["filename"],
                "task_id": task.id,
                "status": "queued"
            })

            logger.info(f"✅ Queued task {task.id} for: {doc_data['filename']}")

        except Exception as e:
            logger.error(f"❌ Failed to queue {doc_data['filename']}: {str(e)}")
            task_info.append({
                "document_id": doc_data.get("document_id"),
                "filename": doc_data.get("filename"),
                "task_id": None,
                "status": "error",
                "error": str(e)
            })

    return {
        "status": "success",
        "total": len(documents_data),
        "tasks": task_info
    }


@celery_app.task(bind=True)
def process_single_document_task(
    self,
    document_id: str,
    file_key: str,
    content_b64: str,
    filename: str,
    content_type: str,
    folder_name: str,
    user_id: str = None,
    organization_id: str = None
) -> Dict[str, Any]:
    """
    Worker task - processes ONE document

    Args:
        self: Celery task instance
        document_id: MongoDB document ID (already created with status="processing")
        file_key: iDrive E2 file path (organization_id/folder/document_id.ext)
        content_b64: Base64-encoded file content
        filename: Original filename
        content_type: MIME type
        folder_name: Folder name
        user_id: User ID
        organization_id: Organization ID

    Returns:
        Processing result
    """
    ingestion_service = None
    try:
        logger.info(f"🚀 Worker processing: {filename} (doc_id: {document_id})")

        # Decode base64 file content
        file_content = base64.b64decode(content_b64)

        # Create ingestion service
        ingestion_service = IngestionService()

        # Use fully synchronous method - no event loop needed
        result = ingestion_service.process_single_document_sync(
            document_id=document_id,
            file_key=file_key,
            file_content=file_content,
            filename=filename,
            content_type=content_type,
            folder_name=folder_name,
            user_id=user_id,
            organization_id=organization_id,
            additional_metadata=None
        )

        logger.info(f"✅ Worker completed: {filename}")
        return {
            "status": "success",
            "document_id": document_id,
            "filename": filename,
            "result": result
        }

    except Exception as e:
        logger.error(f"❌ Worker failed {filename}: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "document_id": document_id,
            "filename": filename,
            "error": str(e)
        }
    finally:
        # CRITICAL: Clean up all client resources and thread pools after EACH task
        if ingestion_service:
            try:
                ingestion_service.cleanup()
                logger.info(f"🧹 Cleaned up resources for: {filename}")
            except Exception as cleanup_error:
                logger.warning(f"Cleanup warning for {filename}: {str(cleanup_error)}")

        # Clean up Unstructured client (singleton with httpx)
        try:
            from clients.unstructured_client import UnstructuredClient
            unstructured_client = UnstructuredClient()
            if hasattr(unstructured_client, 'cleanup'):
                unstructured_client.cleanup()
        except Exception as e:
            logger.warning(f"Unstructured cleanup warning: {str(e)}")

        # Force garbage collection to clean up any lingering thread pools
        gc.collect()
        logger.info(f"🗑️ Forced garbage collection after: {filename}")


@celery_app.task(bind=True)
def process_youtube_document_task(
    self,
    document_id: str,
    youtube_url: str,
    folder_name: str,
    user_id: str = None,
    organization_id: str = None
) -> Dict[str, Any]:
    """
    Worker task - downloads and processes YouTube video

    Args:
        self: Celery task instance
        document_id: MongoDB document ID (already created with status="processing")
        youtube_url: YouTube video URL
        folder_name: Folder name
        user_id: User ID
        organization_id: Organization ID

    Returns:
        Processing result
    """
    from clients.youtube_downloader import YouTubeDownloader
    from clients.mongodb_client import get_mongodb_client
    from bson import ObjectId
    from datetime import datetime

    ingestion_service = None
    temp_file_path = None

    try:
        logger.info(f"🚀 Worker processing YouTube: {youtube_url} (doc_id: {document_id})")

        # 1. Download video (returns bytes directly)
        downloader = YouTubeDownloader()
        logger.info(f"📥 Downloading YouTube video...")

        video_bytes, actual_filename, metadata = downloader.download_video(youtube_url)

        logger.info(f"✅ Downloaded: {actual_filename} ({len(video_bytes) / (1024*1024):.2f} MB)")

        file_size_mb = len(video_bytes) / (1024 * 1024)

        # 3. Build file_key using document_id and extension from downloaded filename
        from utils.file_utils import get_file_extension
        extension = get_file_extension(actual_filename)
        if organization_id:
            file_key = f"{organization_id}/{folder_name}/{document_id}{extension}"
        else:
            file_key = f"{folder_name}/{document_id}{extension}"

        # Update document with actual filename, file_key, and metadata
        mongodb = get_mongodb_client()

        mongodb.update_document(
            collection="documents",
            query={"_id": ObjectId(document_id)},
            update={
                "file_name": actual_filename,
                "file_key": file_key,
                "file_size_mb": file_size_mb,
                "additional_metadata": {
                    "source": "youtube",
                    "youtube_url": youtube_url,
                    "youtube_video_id": metadata.get("video_id"),
                    "youtube_title": metadata.get("title"),
                    "youtube_uploader": metadata.get("uploader"),
                    "youtube_duration": metadata.get("duration"),
                    "youtube_upload_date": metadata.get("upload_date"),
                    "youtube_description": metadata.get("description"),
                },
                "updated_at": datetime.utcnow()
            }
        )

        logger.info(f"📝 Updated document with actual filename: {actual_filename}")

        # 4. Process the video using existing pipeline
        ingestion_service = IngestionService()

        result = ingestion_service.process_single_document_sync(
            document_id=document_id,
            file_key=file_key,
            file_content=video_bytes,
            filename=actual_filename,
            content_type="video/mp4",
            folder_name=folder_name,
            user_id=user_id,
            organization_id=organization_id,
            additional_metadata=None  # Already updated above
        )

        logger.info(f"✅ Worker completed: {actual_filename}")
        return {
            "status": "success",
            "document_id": document_id,
            "filename": actual_filename,
            "result": result
        }

    except Exception as e:
        logger.error(f"❌ Worker failed for YouTube {youtube_url}: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "document_id": document_id,
            "youtube_url": youtube_url,
            "error": str(e)
        }
    finally:
        # CRITICAL: Clean up all client resources
        if ingestion_service:
            try:
                ingestion_service.cleanup()
                logger.info(f"🧹 Cleaned up resources for YouTube video")
            except Exception as cleanup_error:
                logger.warning(f"Cleanup warning: {str(cleanup_error)}")

        # Clean up Unstructured client
        try:
            from clients.unstructured_client import UnstructuredClient
            unstructured_client = UnstructuredClient()
            if hasattr(unstructured_client, 'cleanup'):
                unstructured_client.cleanup()
        except Exception as e:
            logger.warning(f"Unstructured cleanup warning: {str(e)}")

        # Force garbage collection
        gc.collect()
        logger.info(f"🗑️ Forced garbage collection after YouTube video")
