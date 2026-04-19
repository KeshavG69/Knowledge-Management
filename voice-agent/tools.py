"""LiveKit function tool for the voice knowledge agent.

Direct pgvector search — see retriever.py. Scoped by user_id / organization_id
/ document_ids from participant metadata (passed through AgentSession.userdata).
"""

import logging

from livekit.agents import Agent, RunContext, function_tool

from retriever import search
from settings import settings

logger = logging.getLogger("voice-agent.tools")


def _format_hits(hits: list[dict]) -> str:
    if not hits:
        return "No relevant information found in the selected documents."
    lines: list[str] = []
    for idx, hit in enumerate(hits, start=1):
        text = (hit.get("text") or "").strip()
        if not text:
            continue
        file_name = hit.get("file_name") or "Unknown source"
        lines.append(f"[{idx}] ({file_name})\n{text}")
    if not lines:
        return "No relevant information found in the selected documents."
    return "\n\n".join(lines)


class KnowledgeAgent(Agent):
    """Voice agent that answers from the user's selected documents."""

    @function_tool()
    async def search_knowledge_base(
        self,
        context: RunContext,
        query: str,
    ) -> str:
        """Search the user's selected documents for information to answer their question.

        Args:
            query: A focused natural-language search query derived from the user's question.
        """
        ud = context.userdata or {}
        document_ids = ud.get("document_ids")

        if not document_ids:
            return (
                "No documents selected. Ask the user to select documents from the "
                "sidebar before asking knowledge questions."
            )

        user_id = ud.get("user_id")
        organization_id = ud.get("organization_id")
        if not user_id or not organization_id:
            logger.warning("Missing user_id/organization_id in userdata: %s", ud)
            return "Cannot search — user session is not authenticated."

        hits = await search(
            query=query,
            user_id=user_id,
            organization_id=organization_id,
            document_ids=document_ids,
            k=settings.VOICE_AGENT_SEARCH_NUM_DOCUMENTS,
        )
        return _format_hits(hits)
