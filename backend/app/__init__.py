"""
Application initialization
CRITICAL: Pinecone SDK uses multiprocessing internally for batch operations
Must initialize multiprocessing BEFORE any Pinecone imports
"""
import multiprocessing

# Pinecone SDK imports multiprocessing.pool.ApplyResult and uses Pool for parallel ops
# Use 'spawn' method for Railway/cloud environments (safer than 'fork')
try:
    multiprocessing.set_start_method('spawn', force=True)
except RuntimeError:
    # Already set - this is fine
    pass
