from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import multiprocessing

from app.settings import settings
from app.middleware import  SecurityHeadersMiddleware
from app.logger import logger
from routers import health, upload, chat, models, auth

# Fix multiprocessing context for macOS/async compatibility
# This prevents "DummyProcess has no attribute 'terminate'" errors
try:
    multiprocessing.set_start_method('fork', force=True)
except RuntimeError:
    # Already set, ignore
    pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan event handler for startup and shutdown events
    """
    # Startup
    logger.info("🚀 Starting SoldierIQ Backend...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")

    yield

    # Shutdown
    logger.info("🛑 Shutting down SoldierIQ Backend...")


# Initialize FastAPI app
app = FastAPI(
    title="SoldierIQ Backend",
    description="Tactical Intelligence Knowledge Management System",
    version="0.1.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this for production
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Origin",
        "X-Timezone-Offset"
    ],
)

# Add custom middleware
app.add_middleware(SecurityHeadersMiddleware)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint - health check"""
    return JSONResponse(
        content={
            "message": "SoldierIQ Backend is operational",
            "version": "0.1.0",
            "status": "online"
        },
        status_code=200
    )


# Register routers with /api prefix
app.include_router(auth.router, prefix="/api")
app.include_router(health.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(models.router, prefix="/api")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info"
    )
