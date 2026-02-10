"""
Celery Worker Configuration
Handles background task processing for document ingestion
"""
from celery import Celery
from app.settings import settings

# Build Redis URL with authentication if password is provided
def build_redis_url(db: int) -> str:
    """Build Redis URL with optional authentication"""
    if settings.REDIS_PASSWORD:
        # Include password in URL (format: redis://:password@host:port/db)
        return f"redis://:{settings.REDIS_PASSWORD}@{settings.REDIS_HOST}:{settings.REDIS_PORT}/{db}"
    else:
        # No password (local development)
        return f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{db}"

# Initialize Celery app
celery_app = Celery(
    "soldieriq_worker",
    broker=build_redis_url(0),
    backend=build_redis_url(1),
)

# Import task modules to register them with Celery
# This must happen after celery_app is created
import tasks.ingestion_tasks  # noqa: E402, F401

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max per task
    task_soft_time_limit=3000,  # 50 minutes soft limit
    task_acks_late=True,  # Acknowledge after task completes
    worker_prefetch_multiplier=1,  # Fetch one task at a time
)
