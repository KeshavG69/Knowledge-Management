"""
SoldierIQ Backend Application
"""

# NOTE: Multiprocessing code removed - we use ThreadPoolExecutor instead
# The multiprocessing.set_start_method() was causing "DummyProcess" errors
# All concurrency is now handled via app.thread_pool.get_thread_pool()

__version__ = "0.1.0"
