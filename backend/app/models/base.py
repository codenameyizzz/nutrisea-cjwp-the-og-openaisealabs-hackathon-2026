from datetime import datetime, timezone
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB

def utcnow():
    return datetime.now(timezone.utc)

def JsonColumn():
    """Returns JSONB on PostgreSQL and JSON on SQLite for cross-environment flexibility."""
    return JSON().with_variant(JSONB, "postgresql")
