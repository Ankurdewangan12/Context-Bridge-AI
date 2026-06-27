"""
Small shared helpers used across the backend.
"""

import uuid
from datetime import datetime, timezone


def new_session_id() -> str:
    """Generate a short unique id for a transfer session."""
    return uuid.uuid4().hex[:12]


def utc_now_iso() -> str:
    """Current UTC time as an ISO-8601 string (for timestamps in logs)."""
    return datetime.now(timezone.utc).isoformat()
