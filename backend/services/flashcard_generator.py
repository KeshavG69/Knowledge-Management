"""
Flashcard Generator Service
Generates flashcards using Map-Reduce pattern
"""

import asyncio
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from bson import ObjectId

from clients.mongodb_client import get_mongodb_client
from clients.ultimate_llm import get_llm
from app.logger import logger


class FlashcardGeneratorService:
    """Service for generating flashcards using Map-Reduce"""

    def __init__(self):
        """Initialize flashcard generator service"""
        self.mongodb_client = get_mongodb_client()
        self.llm = get_llm(model="google/gemini-3-flash-preview", provider="openrouter")

    async def generate_flashcards(
        self,
        document_ids: List[str],
        user_id: Optional[str] = None,
        organization_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate flashcards using Map-Reduce pattern

        MAP Phase: Extract key concepts from each document
        REDUCE Phase: Create flashcard set with AI-generated title

        Args:
            document_ids: List of document IDs to process
            user_id: Optional user ID
            organization_id: Optional organization ID

        Returns:
            Dict with flashcard data including title and cards
        """
        try:
            total_docs = len(document_ids)
            logger.info(f"🎴 Starting flashcard generation for {total_docs} documents")

            # MAP Phase: Extract concepts from each document
            logger.info("📊 MAP Phase: Extracting concepts from documents")
            concepts = await self._map_extract_concepts(document_ids)

            if not concepts:
                raise Exception("No concepts extracted from documents")

            logger.info(f"✅ MAP Phase complete: Extracted concepts from {len(concepts)} documents")

            # REDUCE Phase: Generate flashcards and title
            logger.info("🔄 REDUCE Phase: Generating flashcards and title")
            flashcard_data = await self._reduce_create_flashcards(concepts)

            logger.info(f"✅ Flashcard generation completed: {len(flashcard_data['cards'])} cards")

            # Save to workflows collection
            workflow_id = await self._save_to_workflows(
                document_ids=document_ids,
                flashcard_data=flashcard_data,
                user_id=user_id,
                organization_id=organization_id
            )

            flashcard_data["workflow_id"] = str(workflow_id)
            flashcard_data["document_count"] = len(document_ids)
            flashcard_data["card_count"] = len(flashcard_data["cards"])
            return flashcard_data

        except Exception as e:
            logger.error(f"❌ Flashcard generation failed: {str(e)}")
            raise

    async def _map_extract_concepts(self, document_ids: List[str]) -> List[Dict[str, Any]]:
        """
        MAP Phase: Extract key concepts from each document in parallel

        Args:
            document_ids: List of document IDs

        Returns:
            List of extracted concepts per document
        """
        semaphore = asyncio.Semaphore(5)

        async def extract_from_one_document(doc_id: str) -> Dict[str, Any]:
            async with semaphore:
                try:
                    # Query MongoDB for document
                    document = await self.mongodb_client.async_find_document(
                        collection="documents",
                        query={"_id": ObjectId(doc_id)}
                    )

                    if not document:
                        logger.warning(f"⚠️ Document {doc_id} not found")
                        return {"document_id": doc_id, "concepts": "", "success": False}

                    filename = document.get("filename", "Unknown")
                    raw_content = document.get("raw_content", "")

                    if not raw_content:
                        logger.warning(f"⚠️ Document {doc_id} has no content")
                        return {"document_id": doc_id, "filename": filename, "concepts": "", "success": False}

                    # Extract concepts using LLM
                    extraction_prompt = f"""Analyze this document and extract key concepts, terms, definitions, facts, processes, formulas, and important information that would be useful for learning flashcards.

Document content:
{raw_content}

Extract all the important concepts in a structured way that can be turned into flashcards."""

                    response = await self.llm.ainvoke(extraction_prompt)
                    concepts = response.content if hasattr(response, 'content') else str(response)

                    logger.info(f"✅ Extracted concepts from: {filename}")

                    return {
                        "document_id": doc_id,
                        "filename": filename,
                        "concepts": concepts,
                        "success": True
                    }

                except Exception as e:
                    logger.error(f"❌ Failed to extract concepts from {doc_id}: {str(e)}")
                    return {"document_id": doc_id, "concepts": "", "success": False, "error": str(e)}

        # Process all documents in parallel
        tasks = [extract_from_one_document(doc_id) for doc_id in document_ids]
        results = await asyncio.gather(*tasks)

        # Filter successful extractions
        successful_results = [r for r in results if r.get("success", False)]

        logger.info(f"📊 Extracted concepts from {len(successful_results)}/{len(document_ids)} documents")
        return successful_results

    async def _reduce_create_flashcards(self, concepts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        REDUCE Phase: Generate flashcards and title from extracted concepts

        Args:
            concepts: List of extracted concepts from documents

        Returns:
            Dict with title and flashcard list
        """
        try:
            # Combine all concepts
            combined_concepts = "\n\n".join([
                f"Document: {c.get('filename', 'Unknown')}\n{c['concepts']}"
                for c in concepts
            ])

            # Generate flashcards and title
            flashcard_prompt = f"""Based on the following extracted concepts from multiple documents, generate a comprehensive set of flashcards for studying.

REQUIREMENTS:
1. Generate AT LEAST 65 flashcards. You can create more (80, 100, 150+) if the content is rich enough.
2. Each flashcard should have:
   - "front": The question, term, or prompt
   - "back": The answer, definition, or explanation
3. Create a descriptive title for this flashcard set based on the main topic (e.g., "Cricket Flashcards", "Biology Chapter 3")
4. Cover various types of content:
   - Key terms and definitions
   - Important facts and dates
   - Processes and procedures
   - Applications and examples
   - Formulas and equations (if applicable)
   - Cause and effect relationships
5. Keep answers concise but complete (1-3 sentences preferred)
6. Ensure comprehensive coverage of all the material

Extracted concepts:
{combined_concepts}

Return ONLY a JSON object in this exact format (no markdown, no code fences):
{{
  "title": "Topic Flashcards",
  "cards": [
    {{"front": "Question or term here", "back": "Answer or definition here"}},
    ...at least 65 cards...
  ]
}}"""

            response = await self.llm.ainvoke(flashcard_prompt)
            response_text = response.content if hasattr(response, 'content') else str(response)

            # Strip markdown code fences if present
            response_text = response_text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]

            response_text = response_text.strip()

            # Parse JSON
            flashcard_data = json.loads(response_text)

            # Validate structure
            if "title" not in flashcard_data or "cards" not in flashcard_data:
                raise ValueError("Invalid flashcard data structure")

            if not isinstance(flashcard_data["cards"], list):
                raise ValueError("Cards must be a list")

            logger.info(f"✅ Generated {len(flashcard_data['cards'])} flashcards with title: {flashcard_data['title']}")

            return flashcard_data

        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse flashcard JSON: {str(e)}")
            logger.error(f"Response: {response_text[:500]}")
            raise Exception(f"Failed to parse flashcard response: {str(e)}")
        except Exception as e:
            logger.error(f"❌ Failed to create flashcards: {str(e)}")
            raise

    async def _save_to_workflows(
        self,
        document_ids: List[str],
        flashcard_data: Dict[str, Any],
        user_id: Optional[str],
        organization_id: Optional[str]
    ) -> ObjectId:
        """
        Save flashcard set to workflows collection

        Args:
            document_ids: List of document IDs
            flashcard_data: Generated flashcard data
            user_id: Optional user ID
            organization_id: Optional organization ID

        Returns:
            Inserted workflow ID
        """
        workflow_doc = {
            "type": "flashcards",
            "document_ids": [ObjectId(doc_id) for doc_id in document_ids],
            "user_id": ObjectId(user_id) if user_id else None,
            "organization_id": ObjectId(organization_id) if organization_id else None,
            "status": "completed",
            "data": {
                "title": flashcard_data["title"],
                "cards": flashcard_data["cards"],
                "card_count": len(flashcard_data["cards"]),
                "document_count": len(document_ids)
            },
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }

        workflow_id = await self.mongodb_client.async_insert_document(
            collection="workflows",
            document=workflow_doc
        )

        logger.info(f"✅ Saved flashcard set to workflows: {workflow_id}")
        return workflow_id


# Singleton instance
_flashcard_generator_service = None


def get_flashcard_generator_service() -> FlashcardGeneratorService:
    """Get or create flashcard generator service singleton"""
    global _flashcard_generator_service
    if _flashcard_generator_service is None:
        _flashcard_generator_service = FlashcardGeneratorService()
    return _flashcard_generator_service
