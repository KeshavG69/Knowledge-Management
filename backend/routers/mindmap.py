"""
Mind Map Router - API endpoints for mind map generation
"""

from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId

from models.mindmap import MindMapRequest
from services.mindmap_service import get_mindmap_service
from app.logger import logger
from auth.dependencies import get_current_user


router = APIRouter(prefix="/mindmap", tags=["mindmap"])


@router.post("/generate")
async def generate_mindmap(request: MindMapRequest, current_user: dict = Depends(get_current_user)):
    """
    Generate mind map from multiple documents (like NotebookLM)

    Returns JSON data structure for frontend rendering

    Args:
        request: MindMapRequest with list of document_ids

    Returns:
        Mind map data with nodes and edges JSON

    Example request:
    ```json
    {
        "document_ids": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
    }
    ```

    Example response:
    ```json
    {
        "success": true,
        "mind_map_id": "...",
        "document_ids": ["...", "..."],
        "summary": "...",
        "key_points": ["...", "..."],
        "mind_map": {
            "nodes": [{"id": "A", "content": "Main Topic"}],
            "edges": [{"from_id": "A", "to_id": "B"}]
        },
        "node_count": 15,
        "edge_count": 14
    }
    ```
    """
    try:
        # Validate all document_ids
        for doc_id in request.document_ids:
            if not ObjectId.is_valid(doc_id):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid document_id format: {doc_id}"
                )

        logger.info(f"🧠 Mind map generation requested for {len(request.document_ids)} documents")

        mindmap_service = get_mindmap_service()
        result = await mindmap_service.generate_from_documents(
            document_ids=request.document_ids
        )

        return {
            "success": True,
            **result
        }

    except ValueError as e:
        logger.error(f"❌ Validation error: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Mind map generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Mind map generation failed: {str(e)}")


@router.get("/{mind_map_id}")
async def get_mindmap(mind_map_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get mind map by ID

    Returns the saved mind map with nodes and edges

    Args:
        mind_map_id: MongoDB mind map ID

    Returns:
        Mind map data
    """
    try:
        # Validate mind_map_id
        if not ObjectId.is_valid(mind_map_id):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid mind_map_id format: {mind_map_id}"
            )

        mindmap_service = get_mindmap_service()
        mind_map = await mindmap_service.get_mindmap(mind_map_id)

        if not mind_map:
            raise HTTPException(status_code=404, detail="Mind map not found")

        return {
            "success": True,
            "data": mind_map
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get mind map: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get mind map: {str(e)}")


@router.get("/list")
async def list_mindmaps(
    user_id: str,
    organization_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    List all mind maps for a user and organization

    Args:
        user_id: MongoDB user ID
        organization_id: MongoDB organization ID

    Returns:
        List of mind maps belonging to the user/organization

    Example:
    GET /api/mindmap/list?user_id=507f1f77bcf86cd799439011&organization_id=507f1f77bcf86cd799439012
    """
    try:
        # Validate IDs
        if not ObjectId.is_valid(user_id):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid user_id format: {user_id}"
            )

        if not ObjectId.is_valid(organization_id):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid organization_id format: {organization_id}"
            )

        logger.info(f"📋 Listing mind maps for user: {user_id}, org: {organization_id}")

        mindmap_service = get_mindmap_service()
        mindmaps = await mindmap_service.list_mindmaps_by_user(user_id, organization_id)

        return {
            "success": True,
            "data": mindmaps,
            "count": len(mindmaps)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to list mind maps: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list mind maps: {str(e)}")
