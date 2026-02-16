"""
Mind Map Router - API endpoints for mind map generation
"""

from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId

from models.mindmap import MindMapRequest
from services.mindmap_service import get_mindmap_service
from app.logger import logger
from auth.keycloak_auth import get_current_user_keycloak


router = APIRouter(prefix="/mindmap", tags=["mindmap"])


@router.post("/generate")
async def generate_mindmap(request: MindMapRequest, current_user: dict = Depends(get_current_user_keycloak)):
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
        # Extract user_id and organization_id from JWT token
        user_id = current_user.get("id")
        organization_id = current_user.get("organization_id")

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
            document_ids=request.document_ids,
            user_id=user_id,
            organization_id=organization_id
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
async def get_mindmap(mind_map_id: str, current_user: dict = Depends(get_current_user_keycloak)):
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
async def list_mindmaps(current_user: dict = Depends(get_current_user_keycloak)):
    """
    List all mind maps for current authenticated user and organization

    Returns:
        List of mind maps belonging to the user/organization

    Example:
    GET /api/mindmap/list
    """
    try:
        # Extract user_id and organization_id from JWT token
        user_id = current_user.get("id")  # Keycloak UUID string
        organization_id = current_user.get("organization_id")  # MongoDB ObjectId string

        if not user_id or not organization_id:
            raise HTTPException(
                status_code=400,
                detail="User must belong to an organization"
            )

        # Validate organization_id format
        if not ObjectId.is_valid(organization_id):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid organization_id format: {organization_id}"
            )

        logger.info(f"📋 Listing mind maps for user: {user_id[:8]}..., org: {organization_id[:8]}...")

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
