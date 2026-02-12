"""
Upload Router - Document ingestion endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from bson import ObjectId
import base64
from services.ingestion_service import get_ingestion_service
from clients.youtube_downloader import get_youtube_downloader
from tasks.ingestion_tasks import process_document_ids_task, process_youtube_document_task
from app.logger import logger
from auth.dependencies import get_current_user
from utils.file_utils import sanitize_filename, get_file_size_mb,get_file_extension

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/documents")
async def upload_documents(
    files: List[UploadFile] = File(..., description="Multiple files to upload"),
    folder_name: str = Form(..., description="Folder name for organization"),
    user_id: Optional[str] = Form(None, description="Optional user ID"),
    organization_id: Optional[str] = Form(None, description="Optional organization ID"),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload multiple documents for ingestion (Celery background processing)

    This endpoint:
    1. Validates input
    2. Creates document records with status="processing" in MongoDB
    3. Returns immediately with document_ids for frontend tracking
    4. Dispatches Celery tasks to process each document:
       - Uploads files to iDrive E2
       - Extracts raw content
       - Stores in MongoDB
       - Chunks content semantically
       - Stores chunks in Pinecone
       - Updates status to "completed" or "failed"

    Args:
        files: List of files to upload
        folder_name: Folder name for organization and filtering
        user_id: Optional user ID for tracking
        organization_id: Optional organization ID for tracking

    Returns:
        Document IDs and Celery task ID for tracking
    """
    try:
        # Validate input
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")

        if not folder_name or not folder_name.strip():
            raise HTTPException(status_code=400, detail="Folder name is required")

        # Validate ObjectIds
        if user_id and not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail=f"Invalid user_id format: {user_id}")

        if organization_id and not ObjectId.is_valid(organization_id):
            raise HTTPException(status_code=400, detail=f"Invalid organization_id format: {organization_id}")

        logger.info(f"📤 Upload request: {len(files)} files, folder={folder_name}")

        # Create document records with status="processing" FIRST (before Celery task)
        ingestion_service = get_ingestion_service()

        documents_data = []
        for file in files:
            # Read file content
            content = await file.read()

            # Encode to base64 for Celery JSON serialization
            content_b64 = base64.b64encode(content).decode('utf-8')

            file_size_mb = get_file_size_mb(content)

            # Create document record with status="processing" (without file_key initially)
            document_id = await ingestion_service._create_document_with_status(
                file_name=file.filename,
                folder_name=folder_name.strip(),
                file_key=None,  # Will be updated with document_id
                file_size_mb=file_size_mb,
                user_id=user_id,
                organization_id=organization_id,
                additional_metadata=None
            )

            # Build file_key using document_id and original extension
            
            extension = get_file_extension(file.filename)
            if organization_id:
                file_key = f"{organization_id}/{folder_name.strip()}/{document_id}{extension}"
            else:
                file_key = f"{folder_name.strip()}/{document_id}{extension}"

            documents_data.append({
                "document_id": document_id,
                "file_key": file_key,
                "content_b64": content_b64,
                "filename": file.filename,
                "content_type": file.content_type
            })

            logger.info(f"📝 Created document record: {document_id} for {file.filename}")

        # Dispatch Celery task (will create individual worker tasks for each document)
        task = process_document_ids_task.delay(
            documents_data=documents_data,
            folder_name=folder_name.strip(),
            user_id=user_id,
            organization_id=organization_id
        )

        logger.info(f"✅ Created {len(documents_data)} document records and dispatched Celery task: {task.id}")

        return {
            "success": True,
            "message": f"Ingestion started for {len(files)} files",
            "data": {
                "total_files": len(files),
                "document_ids": [doc["document_id"] for doc in documents_data],
                "file_names": [doc["filename"] for doc in documents_data],
                "folder_name": folder_name.strip(),
                "task_id": task.id,
                "status": "processing"
            }
        }

    except Exception as e:
        logger.error(f"❌ Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


class YouTubeIngestionRequest(BaseModel):
    """Request model for YouTube URL ingestion"""
    youtube_url: str
    folder_name: str
    user_id: Optional[str] = None
    organization_id: Optional[str] = None


@router.post("/youtube")
async def ingest_youtube_video(
    request: YouTubeIngestionRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Ingest YouTube video by URL (Celery background processing)

    This endpoint:
    1. Validates YouTube URL format
    2. Creates document record with status="processing" in MongoDB (fast!)
    3. Returns immediately with document_id for frontend tracking
    4. Dispatches Celery task to:
       - Download video from YouTube
       - Extract metadata and update document
       - Upload to iDrive E2
       - Extract frames and transcription
       - Chunk content semantically
       - Store chunks in Pinecone
       - Update status to "completed" or "failed"

    Args:
        request: YouTubeIngestionRequest with URL and metadata
        current_user: Authenticated user

    Returns:
        Document ID and Celery task ID for tracking
    """
    try:
        # Validate input
        if not request.youtube_url or not request.youtube_url.strip():
            raise HTTPException(status_code=400, detail="YouTube URL is required")

        if not request.folder_name or not request.folder_name.strip():
            raise HTTPException(status_code=400, detail="Folder name is required")

        # Validate ObjectIds
        if request.user_id and not ObjectId.is_valid(request.user_id):
            raise HTTPException(status_code=400, detail=f"Invalid user_id format: {request.user_id}")

        if request.organization_id and not ObjectId.is_valid(request.organization_id):
            raise HTTPException(status_code=400, detail=f"Invalid organization_id format: {request.organization_id}")

        # Validate YouTube URL
        youtube_downloader = get_youtube_downloader()
        if not youtube_downloader.validate_youtube_url(request.youtube_url):
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")

        logger.info(f"📺 YouTube ingestion request: {request.youtube_url}, folder={request.folder_name}")

        # Create document record with status="processing" (fast - just DB write)
        ingestion_service = get_ingestion_service()

        # Use YouTube URL as placeholder filename initially
        filename = f"YouTube Video - {request.youtube_url.split('=')[-1][:11]}"

        # Add YouTube URL to metadata
        additional_metadata = {
            "source": "youtube",
            "youtube_url": request.youtube_url,
        }

        # Create document record (without file_key initially)
        document_id = await ingestion_service._create_document_with_status(
            file_name=filename,
            folder_name=request.folder_name.strip(),
            file_key=None,  # Will be set by worker after download
            file_size_mb=0,  # Unknown initially, will be updated by worker
            user_id=request.user_id,
            organization_id=request.organization_id,
            additional_metadata=additional_metadata
        )

        logger.info(f"📝 Created document record: {document_id} for YouTube URL")

        # Dispatch Celery task (worker will download, process, and update document)
        task = process_youtube_document_task.delay(
            document_id=document_id,
            youtube_url=request.youtube_url,
            folder_name=request.folder_name.strip(),
            user_id=request.user_id,
            organization_id=request.organization_id
        )

        logger.info(f"✅ YouTube video dispatched to Celery (task_id: {task.id})")

        return {
            "success": True,
            "message": f"YouTube video ingestion started",
            "data": {
                "document_id": document_id,
                "file_name": filename,
                "folder_name": request.folder_name.strip(),
                "task_id": task.id,
                "status": "processing"
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ YouTube ingestion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"YouTube ingestion failed: {str(e)}")


@router.get("/documents/{document_id}")
async def get_document(document_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get document by ID

    Args:
        document_id: MongoDB document ID

    Returns:
        Document data
    """
    try:
        # Validate document_id
        if not ObjectId.is_valid(document_id):
            raise HTTPException(status_code=400, detail=f"Invalid document_id format: {document_id}")

        ingestion_service = get_ingestion_service()
        document = await ingestion_service.get_document(document_id)

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        return {
            "success": True,
            "data": document
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Get document failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get document: {str(e)}")


@router.get("/documents")
async def list_documents(
    folder_name: Optional[str] = None,
    user_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    List documents with optional filters

    Args:
        folder_name: Optional folder name filter
        user_id: Optional user ID filter
        organization_id: Optional organization ID filter
        limit: Maximum number of documents to return (default: 100)
        skip: Number of documents to skip (default: 0)

    Returns:
        List of documents
    """
    try:
        # Validate ObjectIds
        if user_id and not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail=f"Invalid user_id format: {user_id}")

        if organization_id and not ObjectId.is_valid(organization_id):
            raise HTTPException(status_code=400, detail=f"Invalid organization_id format: {organization_id}")

        ingestion_service = get_ingestion_service()
        documents = await ingestion_service.list_documents(
            folder_name=folder_name,
            user_id=user_id,
            organization_id=organization_id,
            limit=limit,
            skip=skip
        )

        return {
            "success": True,
            "data": documents,
            "count": len(documents)
        }

    except Exception as e:
        logger.error(f"❌ List documents failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list documents: {str(e)}")


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    delete_from_storage: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete document and its chunks from all systems

    Args:
        document_id: MongoDB document ID
        delete_from_storage: Whether to delete from iDrive E2 (default: True)

    Returns:
        Deletion result
    """
    try:
        # Validate document_id
        if not ObjectId.is_valid(document_id):
            raise HTTPException(status_code=400, detail=f"Invalid document_id format: {document_id}")

        ingestion_service = get_ingestion_service()
        result = await ingestion_service.delete_document(
            document_id=document_id,
            delete_from_storage=delete_from_storage
        )

        return {
            "success": True,
            "message": "Document deleted successfully",
            "data": result
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Delete document failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")


@router.get("/folders")
async def list_folders(
    user_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    List all unique folder names (knowledge bases)

    Args:
        user_id: Optional user ID filter
        organization_id: Optional organization ID filter

    Returns:
        List of folder names
    """
    try:
        # Validate ObjectIds
        if user_id and not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail=f"Invalid user_id format: {user_id}")

        if organization_id and not ObjectId.is_valid(organization_id):
            raise HTTPException(status_code=400, detail=f"Invalid organization_id format: {organization_id}")

        ingestion_service = get_ingestion_service()
        folders = await ingestion_service.list_folders(
            user_id=user_id,
            organization_id=organization_id
        )

        return {
            "success": True,
            "data": folders,
            "count": len(folders)
        }

    except Exception as e:
        logger.error(f"❌ List folders failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list folders: {str(e)}")


@router.delete("/folders/{folder_name}")
async def delete_folder(
    folder_name: str,
    user_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    delete_from_storage: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete entire folder and all its documents from all systems
    (MongoDB + Pinecone + iDrive E2)

    Args:
        folder_name: Folder name to delete
        user_id: Optional user ID filter
        organization_id: Optional organization ID filter
        delete_from_storage: Whether to delete from iDrive E2 (default: True)

    Returns:
        Deletion result with count
    """
    try:
        # Validate ObjectIds
        if user_id and not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail=f"Invalid user_id format: {user_id}")

        if organization_id and not ObjectId.is_valid(organization_id):
            raise HTTPException(status_code=400, detail=f"Invalid organization_id format: {organization_id}")

        ingestion_service = get_ingestion_service()
        result = await ingestion_service.delete_folder(
            folder_name=folder_name,
            user_id=user_id,
            organization_id=organization_id,
            delete_from_storage=delete_from_storage
        )

        return {
            "success": True,
            "message": f"Folder '{folder_name}' deleted successfully",
            "data": result
        }

    except Exception as e:
        logger.error(f"❌ Delete folder failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete folder: {str(e)}")


@router.put("/folders/{folder_name}")
async def rename_folder(
    folder_name: str,
    new_folder_name: str = Form(..., description="New folder name"),
    user_id: Optional[str] = Form(None, description="Optional user ID"),
    organization_id: Optional[str] = Form(None, description="Optional organization ID"),
    current_user: dict = Depends(get_current_user)
):
    """
    Rename folder across all systems
    (MongoDB + Pinecone metadata)

    Args:
        folder_name: Current folder name
        new_folder_name: New folder name
        user_id: Optional user ID filter
        organization_id: Optional organization ID filter

    Returns:
        Rename result with counts
    """
    try:
        # Validate input
        if not new_folder_name or not new_folder_name.strip():
            raise HTTPException(status_code=400, detail="New folder name is required")

        # Validate ObjectIds
        if user_id and not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail=f"Invalid user_id format: {user_id}")

        if organization_id and not ObjectId.is_valid(organization_id):
            raise HTTPException(status_code=400, detail=f"Invalid organization_id format: {organization_id}")

        ingestion_service = get_ingestion_service()
        result = await ingestion_service.rename_folder(
            old_folder_name=folder_name,
            new_folder_name=new_folder_name.strip(),
            user_id=user_id,
            organization_id=organization_id
        )

        return {
            "success": True,
            "message": f"Folder renamed from '{folder_name}' to '{new_folder_name}' successfully",
            "data": result
        }

    except Exception as e:
        logger.error(f"❌ Rename folder failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to rename folder: {str(e)}")
