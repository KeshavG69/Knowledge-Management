"""
Format Suggester Service
Generates AI-powered format suggestions using Map-Reduce pattern
Saves results to workflows collection with type="report_suggestions"
"""

import asyncio
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from bson import ObjectId

from clients.mongodb_client import get_mongodb_client
from clients.ultimate_llm import get_llm
from app.logger import logger


class FormatSuggesterService:
    """Service for generating format suggestions using Map-Reduce"""

    def __init__(self):
        """Initialize format suggester service"""
        self.mongodb_client = get_mongodb_client()
        self.llm = get_llm(model="google/gemini-3-flash-preview", provider="openrouter")

    async def get_or_create_suggestions(
        self,
        document_ids: List[str],
        user_id: Optional[str] = None,
        organization_id: Optional[str] = None
    ) -> str:
        """
        Get existing suggestions or create new background task

        Checks if suggestions already exist for this document set.
        If yes, returns existing workflow_id. If no, creates new task.

        Args:
            document_ids: List of document IDs
            user_id: Optional user ID
            organization_id: Optional organization ID

        Returns:
            workflow_id: MongoDB workflow ID for tracking
        """
        # Convert to ObjectIds for query
        doc_object_ids = [ObjectId(doc_id) for doc_id in document_ids]

        # Check if suggestions already exist for these documents
        existing = await self.mongodb_client.async_find_document(
            collection="workflows",
            query={
                "type": "report_suggestions",
                "document_ids": {"$all": doc_object_ids},
                "$expr": {"$eq": [{"$size": "$document_ids"}, len(doc_object_ids)]}  # Exact match
            }
        )

        if existing:
            logger.info(f"✅ Found existing suggestions: {existing['_id']}")
            return str(existing["_id"])

        # Create new workflow document with "processing" status
        workflow_doc = {
            "type": "report_suggestions",
            "document_ids": doc_object_ids,
            "user_id": ObjectId(user_id) if user_id else None,
            "organization_id": ObjectId(organization_id) if organization_id else None,
            "status": "processing",
            "data": {},
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }

        workflow_id = await self.mongodb_client.async_insert_document(
            collection="workflows",
            document=workflow_doc
        )

        logger.info(f"🚀 Created new suggestions workflow: {workflow_id}")
        return workflow_id

    async def generate_suggestions_background(
        self,
        workflow_id: str,
        document_ids: List[str],
        user_id: Optional[str] = None,
        organization_id: Optional[str] = None
    ):
        """
        Background task to generate format suggestions using Map-Reduce

        MAP Phase: Analyze each document
        REDUCE Phase: Generate format suggestions from analyses

        Args:
            workflow_id: MongoDB workflow ID to update
            document_ids: List of document IDs to analyze
            user_id: Optional user ID
            organization_id: Optional organization ID
        """
        try:
            logger.info(f"🔄 Starting format suggestions for workflow: {workflow_id}")

            # MAP Phase: Analyze each document in parallel (with semaphore)
            analyses = await self._map_analyze_documents(document_ids)

            if not analyses:
                raise ValueError("No document analyses generated")

            # REDUCE Phase: Create format suggestions from analyses
            suggestions = await self._reduce_create_suggestions(analyses)

            # Update workflow with completed suggestions
            await self.mongodb_client.async_update_document(
                collection="workflows",
                query={"_id": ObjectId(workflow_id)},
                update={
                    "$set": {
                        "status": "completed",
                        "data": {
                            "suggestions": suggestions,
                            "analysis_count": len(analyses)
                        },
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )

            logger.info(f"✅ Format suggestions completed: {len(suggestions)} suggestions")

        except Exception as e:
            logger.error(f"❌ Format suggestions failed: {str(e)}")

            # Update workflow with error status
            await self.mongodb_client.async_update_document(
                collection="workflows",
                query={"_id": ObjectId(workflow_id)},
                update={
                    "$set": {
                        "status": "failed",
                        "data": {
                            "error": str(e)
                        },
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )

    async def _map_analyze_documents(
        self,
        document_ids: List[str]
    ) -> List[Dict[str, Any]]:
        """
        MAP Phase: Analyze each document in parallel with semaphore

        Args:
            document_ids: List of document IDs

        Returns:
            List of document analyses
        """
        logger.info(f"📊 MAP Phase: Analyzing {len(document_ids)} documents")

        # Semaphore to limit concurrent analysis to 5
        semaphore = asyncio.Semaphore(5)

        async def analyze_one_document(doc_id: str) -> Dict[str, Any]:
            """Analyze a single document with semaphore"""
            async with semaphore:
                try:
                    # Query MongoDB directly for raw_content
                    document = await self.mongodb_client.async_find_document(
                        collection="documents",
                        query={"_id": ObjectId(doc_id)}
                    )

                    if not document:
                        return {"document_id": doc_id, "analysis": "Document not found", "success": False}

                    raw_content = document.get("raw_content", "")
                    filename = document.get("filename", "Unknown")

                    if not raw_content:
                        return {"document_id": doc_id, "filename": filename, "analysis": "No content found", "success": False}

                    # Ask LLM to analyze (simple, natural analysis)
                    analysis_prompt = f"""Analyze this document briefly. Describe:
- What is the main topic?
- What type of content is this?
- What are the key themes?

Keep it concise (2-3 sentences).

Document content:
{raw_content}"""

                    response = await self.llm.ainvoke(analysis_prompt)
                    analysis = response.content if hasattr(response, 'content') else str(response)

                    return {
                        "document_id": doc_id,
                        "filename": filename,
                        "analysis": analysis,
                        "success": True
                    }

                except Exception as e:
                    logger.error(f"❌ Failed to analyze document {doc_id}: {str(e)}")
                    return {"document_id": doc_id, "analysis": str(e), "success": False}

        # Process ALL documents in parallel (MAP) with semaphore limiting to 5 concurrent
        tasks = [analyze_one_document(doc_id) for doc_id in document_ids]
        analyses = await asyncio.gather(*tasks)

        # Filter out failed analyses
        successful_analyses = [a for a in analyses if a.get("success")]
        logger.info(f"✅ MAP Phase complete: {len(successful_analyses)}/{len(document_ids)} documents analyzed")

        return successful_analyses

    async def _reduce_create_suggestions(self, analyses: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        """
        REDUCE Phase: Create format suggestions from document analyses

        Args:
            analyses: List of document analyses from MAP phase

        Returns:
            List of format suggestions with name, description, prompt
        """
        logger.info(f"🔄 REDUCE Phase: Creating suggestions from {len(analyses)} analyses")

        # Combine all analyses
        combined_analysis = "\n\n".join([
            f"Document {i+1}: {a.get('filename', 'Unknown')}\n{a['analysis']}"
            for i, a in enumerate(analyses)
        ])

        # Ask LLM to create custom format suggestions
        suggestion_prompt = f"""Based on these document analyses, create 3-4 custom report format suggestions.

Document Analyses:
{combined_analysis}

Create format suggestions that are SPECIFIC to this content. Do NOT use generic names.

Examples of good suggestions:
- If docs are about Kubernetes: "Kubernetes Deployment Guide", "Container Security Manual"
- If docs are about cricket: "Cricket Analytics Report", "Player Performance Analysis"
- If docs are about business: "Strategic Planning Document", "Market Analysis Report"

For each suggestion, provide:
1. name: Specific, descriptive name based on actual content
2. description: What this format will create (1 sentence)
3. prompt: Detailed prompt for generating the report (should specify structure and sections)

Return as JSON array:
[
  {{
    "name": "Specific Format Name",
    "description": "What this format creates",
    "prompt": "Create a report with: 1) Section one, 2) Section two, 3) Section three. Include source citations."
  }}
]

Be creative and specific!"""

        response = await self.llm.ainvoke(suggestion_prompt)

        # Extract content from LangChain message object
        response_text = response.content if hasattr(response, 'content') else str(response)

        # Strip markdown code fences if present
        if response_text.strip().startswith("```json"):
            response_text = response_text.strip()[7:]  # Remove ```json
        if response_text.strip().startswith("```"):
            response_text = response_text.strip()[3:]  # Remove ```
        if response_text.strip().endswith("```"):
            response_text = response_text.strip()[:-3]  # Remove trailing ```

        response_text = response_text.strip()

        # Parse JSON response
        try:
            suggestions = json.loads(response_text)
            if not isinstance(suggestions, list):
                suggestions = []
        except Exception as e:
            logger.error(f"❌ Failed to parse suggestions JSON: {e}")
            logger.error(f"Response text: {response_text[:500]}")
            suggestions = []

        # Validate suggestions
        valid_suggestions = []
        for s in suggestions:
            if isinstance(s, dict) and "name" in s and "description" in s and "prompt" in s:
                valid_suggestions.append(s)

        logger.info(f"✅ REDUCE Phase complete: {len(valid_suggestions)} suggestions created")

        return valid_suggestions

    async def get_suggestions_by_documents(
        self,
        document_ids: List[str]
    ) -> Dict[str, Any]:
        """
        Get format suggestions by document IDs (for frontend polling)

        Args:
            document_ids: List of document IDs

        Returns:
            Dict with status and suggestions
        """
        try:
            # Convert to ObjectIds
            doc_object_ids = [ObjectId(doc_id) for doc_id in document_ids]

            # Find workflow for these documents
            workflow = await self.mongodb_client.async_find_document(
                collection="workflows",
                query={
                    "type": "report_suggestions",
                    "document_ids": {"$all": doc_object_ids},
                    "$expr": {"$eq": [{"$size": "$document_ids"}, len(doc_object_ids)]}
                }
            )

            if not workflow:
                return {"status": "not_found", "suggestions": None}

            # Extract status and data
            status = workflow.get("status", "processing")
            data = workflow.get("data", {})

            return {
                "status": status,
                "suggestions": data.get("suggestions", []) if status == "completed" else None,
                "error": data.get("error") if status == "failed" else None,
                "created_at": workflow.get("created_at"),
                "updated_at": workflow.get("updated_at")
            }

        except Exception as e:
            logger.error(f"❌ Failed to get suggestions: {str(e)}")
            return {"status": "error", "suggestions": None, "error": str(e)}


# Singleton instance
_format_suggester_service = None


def get_format_suggester_service() -> FormatSuggesterService:
    """Get or create FormatSuggesterService singleton"""
    global _format_suggester_service
    if _format_suggester_service is None:
        _format_suggester_service = FormatSuggesterService()
    return _format_suggester_service
