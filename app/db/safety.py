from __future__ import annotations

from urllib.parse import unquote, urlsplit


class UnsafeDatabaseTarget(ValueError):
    """Raised when a destructive/test operation targets a non-test database."""


def database_name(database_url: str) -> str:
    name = unquote(urlsplit(database_url).path.lstrip("/"))
    if not name:
        raise UnsafeDatabaseTarget("database URL does not contain a database name")
    return name


def psycopg_async_url(database_url: str) -> str:
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)
    return database_url


def require_test_database(database_url: str) -> str:
    name = database_name(database_url)
    if not name.endswith("_test"):
        raise UnsafeDatabaseTarget(
            "refusing test or destructive operation: database name must end with _test"
        )
    return name
