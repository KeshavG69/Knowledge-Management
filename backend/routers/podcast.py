from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from services.podcast_service import get_podcast_service, PodcastService
from app.logger import logger
from models.podcast import PodcastEpisode
from clients.mongodb_client import get_mongodb_client, MongoDBClient
from bson import ObjectId
from datetime import datetime
from auth.dependencies import get_current_user

router = APIRouter(prefix="/podcasts", tags=["Podcasts"])

class PodcastGenerateRequest(BaseModel):
    document_ids: List[str]
    organization_id: str

class PodcastResponse(BaseModel):
    episode_id: str
    status: str
    message: str

@router.post("/generate", summary="Start podcast generation (Background Task)", response_model=PodcastResponse)
async def generate_podcast(
    request: PodcastGenerateRequest,
    background_tasks: BackgroundTasks,
    service: PodcastService = Depends(get_podcast_service),
    mongodb: MongoDBClient = Depends(get_mongodb_client),
    current_user: dict = Depends(get_current_user)
):
    """
    Start the podcast generation process in the background.
    Returns an episode_id to track progress.
    """
    try:
        logger.info(f"🎙️ Received podcast generation request for {len(request.document_ids)} documents (Org: {request.organization_id})")
        
        # Verify document IDs are not empty
        if not request.document_ids:
            raise HTTPException(status_code=400, detail="No document IDs provided")
            
        # Create initial PodcastEpisode record (As Dict, no Pydantic model needed per user)
        episode = {
            "organization_id": request.organization_id,
            "document_ids": request.document_ids,
            "status": "processing",
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Insert into MongoDB to get ID
        episode_id = await mongodb.async_insert_document("podcasts", episode)
        
        # Add to background tasks
        background_tasks.add_task(
            service.generate_podcast, 
            request.document_ids, 
            request.organization_id, 
            episode_id
        )
        
        return PodcastResponse(
            episode_id=episode_id,
            status="processing",
            message="Podcast generation started in background"
        )
        
    except Exception as e:
        logger.error(f"Error starting podcast generation: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get("/{episode_id}", summary="Get podcast status/result")
async def get_podcast(
    episode_id: str,
    mongodb: MongoDBClient = Depends(get_mongodb_client),
    current_user: dict = Depends(get_current_user)
):
    """
    Get the status and result of a podcast generation task.
    """
    if not ObjectId.is_valid(episode_id):
        raise HTTPException(status_code=400, detail="Invalid Podcast ID")
        
    podcast = await mongodb.async_find_document("podcasts", {"_id": ObjectId(episode_id)})
    
    if not podcast:
        raise HTTPException(status_code=404, detail="Podcast not found")
        
    # Convert _id to string for JSON response
    podcast["id"] = str(podcast.pop("_id"))
    return podcast
