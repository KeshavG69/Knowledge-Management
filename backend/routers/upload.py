"""
Upload Router - Document ingestion endpoints
"""

import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from bson import ObjectId
from services.ingestion_service import get_ingestion_service
from clients.mongodb_client import get_mongodb_client
from app.logger import logger


router = APIRouter(prefix="/upload", tags=["upload"])


async def process_ingestion_in_background(
    document_ids: List[str],
    file_data: List[Dict[str, Any]],
    folder_name: str,
    user_id: Optional[str],
    organization_id: Optional[str]
):
    """
    Background task for document ingestion

    Documents already exist with status="processing" (created in upload endpoint).
    This function updates those existing documents throughout the pipeline.

    Args:
        document_ids: List of pre-created document IDs
        file_data: List of dicts with 'content', 'filename', 'content_type'
        folder_name: Folder name for organization
        user_id: Optional user ID
        organization_id: Optional organization ID
    """
    ingestion_service = get_ingestion_service()

    try:
        logger.info(f"🚀 Background ingestion started for {len(file_data)} files")

        # Process each file individually with its document ID
        from io import BytesIO
        from fastapi import UploadFile

        for i, (document_id, file_info) in enumerate(zip(document_ids, file_data)):
            try:
                logger.info(f"📄 Processing file {i+1}/{len(file_data)}: {file_info['filename']}")

                # Reconstruct UploadFile object
                file_obj = BytesIO(file_info["content"])
                upload_file = UploadFile(
                    file=file_obj,
                    filename=file_info["filename"],
                    headers={"content-type": file_info["content_type"]}
                )

                # Process this single file (will update existing document)
                await ingestion_service._process_single_document_with_existing_id(
                    document_id=document_id,
                    file=upload_file,
                    folder_name=folder_name,
                    user_id=user_id,
                    organization_id=organization_id
                )

                logger.info(f"✅ Completed processing: {file_info['filename']}")

            except Exception as e:
                logger.error(f"❌ Failed to process {file_info['filename']}: {str(e)}")
                # Mark this document as failed
                await ingestion_service._update_document_status(
                    document_id=document_id,
                    status="failed",
                    stage="failed",
                    stage_description=f"Processing failed: {str(e)}",
                    error=str(e),
                    failed_at=datetime.utcnow()
                )

        logger.info(f"✅ Background ingestion completed for all files")

    except Exception as e:
        logger.error(f"❌ Background ingestion failed: {str(e)}")


@router.post("/documents")
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(..., description="Multiple files to upload"),
    folder_name: str = Form(..., description="Folder name for organization"),
    user_id: Optional[str] = Form(None, description="Optional user ID"),
    organization_id: Optional[str] = Form(None, description="Optional organization ID")
):
    """
    Upload multiple documents for ingestion (background processing)

    This endpoint:
    1. Validates input
    2. Returns immediately with file list
    3. Processes ingestion in background:
       - Creates document records with status="processing"
       - Uploads files to iDrive E2
       - Extracts raw content
       - Stores in MongoDB
       - Chunks content semantically
       - Stores chunks in Pinecone
       - Updates status to "completed" or "failed"

    Args:
        background_tasks: FastAPI background tasks
        files: List of files to upload
        folder_name: Folder name for organization and filtering
        user_id: Optional user ID for tracking
        organization_id: Optional organization ID for tracking

    Returns:
        List of filenames that will be processed
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

        # Read file contents into memory (UploadFile streams won't be available in background task)
        file_data = []
        for file in files:
            content = await file.read()
            file_data.append({
                "content": content,
                "filename": file.filename,
                "content_type": file.content_type
            })
            await file.seek(0)  # Reset file pointer

        # Create document records with status="processing" FIRST (before background task)
        ingestion_service = get_ingestion_service()
        from utils.file_utils import sanitize_filename, get_file_size_mb, get_file_extension

        document_ids = []
        for file_info in file_data:
            safe_filename = sanitize_filename(file_info["filename"])
            # Include organization_id in file_key for multi-tenant isolation
            if organization_id:
                file_key = f"{organization_id}/{folder_name.strip()}/{safe_filename}"
            else:
                file_key = f"{folder_name.strip()}/{safe_filename}"  # Backwards compatibility
            file_size_mb = get_file_size_mb(file_info["content"])

            # Create document record with status="processing"
            document_id = await ingestion_service._create_document_with_status(
                file_name=file_info["filename"],
                folder_name=folder_name.strip(),
                file_key=file_key,
                file_size_mb=file_size_mb,
                user_id=user_id,
                organization_id=organization_id,
                additional_metadata=None
            )
            document_ids.append(document_id)
            logger.info(f"📝 Created document record: {document_id} for {file_info['filename']}")

        # Add background task (will update existing documents)
        background_tasks.add_task(
            process_ingestion_in_background,
            document_ids=document_ids,
            file_data=file_data,
            folder_name=folder_name.strip(),
            user_id=user_id,
            organization_id=organization_id
        )

        logger.info(f"✅ Created {len(document_ids)} document records and queued for background processing")

        return {
            "success": True,
            "message": f"Ingestion started for {len(files)} files",
            "data": {
                "total_files": len(files),
                "document_ids": document_ids,
                "file_names": [f["filename"] for f in file_data],
                "folder_name": folder_name.strip(),
                "status": "processing"
            }
        }

    except Exception as e:
        logger.error(f"❌ Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/documents/{document_id}")
async def get_document(document_id: str):
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
    skip: int = 0
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
    delete_from_storage: bool = True
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
    organization_id: Optional[str] = None
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
    delete_from_storage: bool = True
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
    organization_id: Optional[str] = Form(None, description="Optional organization ID")
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
