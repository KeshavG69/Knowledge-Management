"""
Chat API Endpoints
Handles conversational AI interactions with knowledge base using SSE streaming
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from services.chat import create_chat_agent
from services.agent_streaming import stream_agent_response
from utils.streaming import create_sse_event_stream
from app.logger import logger
from auth.dependencies import get_current_user
import uuid

router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    """Request model for chat endpoint"""
    message: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    organization_id: Optional[str] = None
    document_ids: Optional[list[str]] = None
    model: Optional[str] = "anthropic/claude-sonnet-4.5"


@router.post("/chat")
async def chat(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """
    Send a message to the chat agent and get a streaming response

    Args:
        request: ChatRequest with message and optional parameters

    Returns:
        StreamingResponse with SSE events
    """
    try:
        # Validate input
        if not request.message or request.message.strip() == "":
            raise HTTPException(
                status_code=400,
                detail="Message is required and cannot be empty"
            )

        # Generate session_id if not provided
        session_id = request.session_id or str(uuid.uuid4())

        logger.info(
            f"Chat request: session={session_id}, "
            f"message='{request.message[:50]}...'"
        )

        # Create chat agent
        agent = await create_chat_agent(
            session_id=session_id,
            user_id=request.user_id,
            organization_id=request.organization_id,
            document_ids=request.document_ids,
            model=request.model,
            
        )

        # SSE headers
        headers = {
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "Vary": "Accept",
        }

        # Stream response
        async def sse_stream():
            events = stream_agent_response(request.message, agent)
            async for chunk in create_sse_event_stream(events):
                yield chunk

        return StreamingResponse(
            sse_stream(),
            media_type="text/event-stream",
            headers=headers
        )

    except Exception as e:
        logger.error(f"Chat endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint for chat service"""
    return {"status": "healthy", "service": "chat"}
