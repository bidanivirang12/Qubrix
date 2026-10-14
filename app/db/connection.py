from __future__ import annotations


def psycopg_async_url(validated_database_url: str) -> str:
    """Convert a validated PostgreSQL URL to the psycopg async SQLAlchemy dialect."""
    if validated_database_url.startswith("postgresql://"):
        return validated_database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    if validated_database_url.startswith("postgres://"):
        return validated_database_url.replace("postgres://", "postgresql+psycopg://", 1)
    return validated_database_url


def psycopg_sync_url(validated_database_url: str) -> str:
    """Convert a validated PostgreSQL URL to the synchronous psycopg dialect."""
    if validated_database_url.startswith("postgresql+psycopg://"):
        return validated_database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    if validated_database_url.startswith("postgres://"):
        return validated_database_url.replace("postgres://", "postgresql://", 1)
    return validated_database_url
