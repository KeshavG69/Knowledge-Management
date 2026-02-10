"""
Global Thread Pool for Blocking Operations

This module provides a shared thread pool executor that limits concurrent threads
across the entire application to prevent thread exhaustion and "can't start new thread" errors.

Usage:
    from app.thread_pool import get_thread_pool

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        get_thread_pool(),
        blocking_function,
        arg1, arg2
    )
"""

from concurrent.futures import ThreadPoolExecutor
from app.settings import settings
from app.logger import logger

# Global thread pool instance (singleton)
_thread_pool: ThreadPoolExecutor = None


def get_thread_pool() -> ThreadPoolExecutor:
    """
    Get or create the global thread pool executor.

    This thread pool is shared across the entire application to prevent
    thread exhaustion from unlimited thread creation.

    Returns:
        ThreadPoolExecutor: Shared thread pool with limited workers
    """
    global _thread_pool

    if _thread_pool is None:
        max_workers = settings.MAX_THREAD_WORKERS
        _thread_pool = ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="app_worker"
        )
        logger.info(f"🔧 Global thread pool initialized with {max_workers} workers")

    return _thread_pool


def shutdown_thread_pool(wait: bool = True):
    """
    Shutdown the global thread pool.

    Args:
        wait: If True, wait for all threads to complete before returning
    """
    global _thread_pool

    if _thread_pool is not None:
        _thread_pool.shutdown(wait=wait)
        _thread_pool = None
        logger.info("🧹 Global thread pool shut down")
