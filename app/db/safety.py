from __future__ import annotations

import re
from urllib.parse import SplitResult, parse_qsl, unquote, urlsplit

from sqlalchemy import text
from sqlalchemy.engine import Connection

_TEST_DATABASE_PATTERN = re.compile(r"^qubrix_(?:test|[a-z0-9][a-z0-9_]*_test)$")
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
_CONFIGURED_CI_HOSTS = {"postgres"}
_ALLOWED_QUERY_PARAMETERS = {"sslmode"}


class UnsafeDatabaseTarget(ValueError):
    """Raised when a destructive/test operation targets an unsafe database."""


def _parse_url(database_url: str) -> tuple[SplitResult, str]:
    if any(
        character.isspace() or ord(character) < 32 or ord(character) == 127
        for character in database_url
    ):
        raise UnsafeDatabaseTarget("database URL must not contain whitespace or control characters")
    try:
        parsed = urlsplit(database_url)
        hostname = parsed.hostname
        query_parameters = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
    except ValueError as error:
        raise UnsafeDatabaseTarget("database URL is malformed") from error
    if parsed.scheme not in {"postgres", "postgresql", "postgresql+psycopg"}:
        raise UnsafeDatabaseTarget("database URL must use a PostgreSQL scheme")
    if not hostname:
        raise UnsafeDatabaseTarget("database URL must include an explicit host")
    if parsed.fragment:
        raise UnsafeDatabaseTarget("database URL must not include a fragment")
    parameter_names = [name.lower() for name, _ in query_parameters]
    if any(name not in _ALLOWED_QUERY_PARAMETERS for name in parameter_names):
        raise UnsafeDatabaseTarget("database URL contains a disallowed query parameter")
    if len(parameter_names) != len(set(parameter_names)):
        raise UnsafeDatabaseTarget("database URL contains duplicate query parameters")
    if any(
        name.lower() == "sslmode"
        and value.lower()
        not in {"disable", "allow", "prefer", "require", "verify-ca", "verify-full"}
        for name, value in query_parameters
    ):
        raise UnsafeDatabaseTarget("database URL contains an invalid sslmode value")
    return parsed, hostname.lower()


def validate_database_url(database_url: str) -> None:
    """Validate PostgreSQL URL structure and connection query options before driver conversion."""
    _parse_url(database_url)


def database_name(database_url: str) -> str:
    parsed, _ = _parse_url(database_url)
    raw_name = parsed.path[1:] if parsed.path.startswith("/") else parsed.path
    name = unquote(raw_name)
    if not name:
        raise UnsafeDatabaseTarget("database URL does not contain a database name")
    if raw_name != name:
        raise UnsafeDatabaseTarget("database name must not contain percent-encoded characters")
    if any(
        character.isspace() or ord(character) < 32 or ord(character) == 127 for character in name
    ):
        raise UnsafeDatabaseTarget(
            "database name must not contain whitespace or control characters"
        )
    if "\x00" in name:
        raise UnsafeDatabaseTarget("database name must not contain a null byte")
    if not _TEST_DATABASE_PATTERN.fullmatch(name):
        raise UnsafeDatabaseTarget(
            "refusing test or destructive operation: database name must match "
            "qubrix_test or qubrix_[a-z0-9][a-z0-9_]*_test"
        )
    return name


def require_test_database(
    database_url: str,
    *,
    allow_nonlocal_host: bool = False,
) -> str:
    name = database_name(database_url)
    _, hostname = _parse_url(database_url)
    allowed_hosts: set[str] = _LOCAL_HOSTS | (
        _CONFIGURED_CI_HOSTS if allow_nonlocal_host else set()
    )
    if hostname not in allowed_hosts:
        raise UnsafeDatabaseTarget("refusing test or destructive operation on a non-local host")
    return name


def verify_current_database(connection: Connection, expected_name: str) -> None:
    """Refuse destructive work unless this established connection reached its expected DB."""
    actual_name = connection.scalar(text("SELECT current_database()"))
    if actual_name != expected_name:
        raise UnsafeDatabaseTarget(
            "connected database does not match the validated expected database"
        )
