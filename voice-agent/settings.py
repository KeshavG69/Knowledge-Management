"""Voice-agent settings — loaded from .env locally, from LiveKit Cloud secrets in prod."""

from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv(".env", override=True)


class Settings(BaseSettings):
    # LiveKit Cloud — auto-injected at runtime on LK Cloud deploys.
    LIVEKIT_URL: str = ""
    LIVEKIT_API_KEY: str = ""
    LIVEKIT_API_SECRET: str = ""

    # LLM (Claude Haiku 4.5 via OpenRouter)
    OPENROUTER_API_KEY: str = ""

    # Retrieval
    POSTGRES_VECTOR_URL: str = ""
    OPENAI_API_KEY: str = ""  # used for text-embedding-3-small

    # Tunables
    VOICE_AGENT_SEARCH_NUM_DOCUMENTS: int = 5

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
