from pydantic import BaseModel, Field
from typing import List, Optional


class GenerateFlashcardsRequest(BaseModel):
    """Request to generate flashcards from documents"""
    document_ids: List[str] = Field(..., description="Document IDs to generate flashcards from")
    user_id: Optional[str] = Field(None, description="User ID")
    organization_id: Optional[str] = Field(None, description="Organization ID")
