from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv(".env", override=True)


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "SoldierIQ Backend"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Database
    MONGODB_URL: str = ""
    MONGODB_DATABASE: str = "soldieriq"



    # LLM APIs
    OPENAI_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    ELEVENLABS_API_KEY: str = ""
    FUNCTION_API_KEY: str = ""  


    # iDrive E2 Storage
    IDRIVEE2_ENDPOINT_URL: str = ""
    IDRIVEE2_ACCESS_KEY_ID: str = ""
    IDRIVEE2_SECRET_ACCESS_KEY: str = ""
    IDRIVEE2_BUCKET_NAME: str = ""

    # Document Processing
    UNSTRUCTURED_API_KEY: str = ""
    UNSTRUCTURED_API_URL: str = ""

    # Video Processing
    VIDEO_TARGET_FPS: int = 4  # Frame extraction rate (frames per second)
    VIDEO_SSIM_THRESHOLD: float = 0.6  # Scene detection sensitivity (0-1)
    VIDEO_MIN_CLIP_DURATION: float = 10.0  # Minimum scene length in seconds
    VIDEO_MAX_CLIP_DURATION: float = 45.0  # Maximum scene length in seconds

    # File Storage
    PRESIGNED_URL_EXPIRATION: int = 604800  # 7 days in seconds (maximum)

    # Redis Configuration (for Celery)
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""

    # Celery Configuration
    CELERY_BROKER_URL: str = ""  # Will be set from REDIS_HOST/PORT
    CELERY_RESULT_BACKEND: str = ""  # Will be set from REDIS_HOST/PORT

    # Keycloak Authentication
    KEYCLOAK_SERVER_URL: str = "http://localhost:8080"
    KEYCLOAK_REALM: str = "SoldierIQ"
    KEYCLOAK_CLIENT_ID: str = "soldieriq-backend"
    KEYCLOAK_CLIENT_SECRET: str = ""

    # Keycloak Admin (for creating users programmatically)
    KEYCLOAK_ADMIN_USERNAME: str = "admin"
    KEYCLOAK_ADMIN_PASSWORD: str = "admin"

    POSTGRES_URL: str = ""

    # FalkorDB
    GRAPH_DATABASE_URL: str = "localhost"
    GRAPH_DATABASE_PORT: int = 6379
    GRAPH_DATABASE_USERNAME: str = ""
    GRAPH_DATABASE_PASSWORD: str = ""
    GRAPH_DATABASE_SSL: bool = False

    # Embeddings + extraction
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIM: int = 1536
    EXTRACTION_MODEL: str = "google/gemini-2.5-flash"
    ONTOLOGY_MODEL: str = "google/gemini-2.5-flash"

    # Ingestion
    CHUNK_SIZE: int = 3000
    CHUNK_OVERLAP: int = 200
    LLM_CONCURRENCY: int = 10
    MIN_TRIPLE_CONFIDENCE: float = 0.7
    ENTITY_RESOLUTION_THRESHOLD: float = 0.15  # cosine distance — lower = stricter merge

    # Observability

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
