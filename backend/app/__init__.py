"""
SoldierIQ Backend Application
"""

# Fix multiprocessing context BEFORE any other imports
# This prevents "DummyProcess has no attribute 'terminate'" errors
import multiprocessing
try:
    multiprocessing.set_start_method('fork', force=True)
except RuntimeError:
    pass  # Already set

__version__ = "0.1.0"
