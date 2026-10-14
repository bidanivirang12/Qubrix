from __future__ import annotations

from unittest.mock import Mock

import pytest
from sqlalchemy.engine import Connection

from app.db.connection import psycopg_async_url, psycopg_sync_url
from app.db.safety import (
    UnsafeDatabaseTarget,
    database_name,
    require_test_database,
    verify_current_database,
)


def test_database_name_parses_postgresql_url() -> None:
    assert database_name("postgresql+psycopg://user:pass@localhost:5432/qubrix_test") == (
        "qubrix_test"
    )


@pytest.mark.parametrize(
    "url",
    [
        "postgresql://user:pass@localhost/",
        "postgresql://user:pass@localhost",
    ],
)
def test_guard_rejects_empty_database_path(url: str) -> None:
    with pytest.raises(UnsafeDatabaseTarget, match="does not contain a database name"):
        require_test_database(url)


@pytest.mark.parametrize(
    "database",
    [
        "Qubrix_test",
        "qubrix_TEST",
        "_test",
        "qubrix__test",
        "integration_test",
        "qubrix_bad name_test",
        "qubrix_bad%20name_test",
        "qubrix_bad%00name_test",
        "qubrix_bad\x00name_test",
        "qubrix_bad\nname_test",
        "qubrix_bad%2Fname_test",
    ],
)
def test_guard_rejects_invalid_database_names(database: str) -> None:
    url_database = database.replace("\x00", "%00").replace("\n", "%0A")
    with pytest.raises(UnsafeDatabaseTarget):
        require_test_database(f"postgresql://user:pass@localhost/{url_database}")


def test_guard_accepts_only_strict_qubrix_test_names() -> None:
    assert (
        require_test_database("postgresql://user:pass@localhost/qubrix_integration_test")
        == "qubrix_integration_test"
    )
    with pytest.raises(UnsafeDatabaseTarget, match="must match"):
        require_test_database("postgresql://user:pass@localhost/qubrix_dev")


@pytest.mark.parametrize(
    "query",
    [
        "dbname=qubrix_safe_test",
        "host=localhost",
        "hostaddr=127.0.0.1",
        "service=local",
        "options=-csearch_path%3Dpublic",
        "passfile=/tmp/pgpass",
        "sslmode=require&sslmode=disable",
    ],
)
def test_guard_rejects_query_parameters_that_can_change_connection_target(query: str) -> None:
    with pytest.raises(UnsafeDatabaseTarget, match="query parameter"):
        require_test_database(f"postgresql://user:pass@localhost/qubrix_safe_test?{query}")


def test_guard_allows_sslmode_query_parameter() -> None:
    assert (
        require_test_database("postgresql://user:pass@localhost/qubrix_safe_test?sslmode=require")
        == "qubrix_safe_test"
    )


def test_guard_rejects_nonlocal_host_without_explicit_opt_in() -> None:
    with pytest.raises(UnsafeDatabaseTarget, match="non-local host"):
        require_test_database("postgresql://user:pass@db.example.invalid/qubrix_test")


@pytest.mark.parametrize("host", ["localhost", "127.0.0.1", "[::1]"])
def test_guard_allows_local_hosts(host: str) -> None:
    assert require_test_database(f"postgresql://user:pass@{host}/qubrix_test") == "qubrix_test"


def test_guard_allows_ci_service_host_only_with_explicit_opt_in() -> None:
    url = "postgresql://user:pass@postgres/qubrix_test"
    with pytest.raises(UnsafeDatabaseTarget, match="non-local host"):
        require_test_database(url)
    assert require_test_database(url, allow_nonlocal_host=True) == "qubrix_test"


def test_validate_postgresql_dialect_conversion_helpers() -> None:
    assert (
        psycopg_async_url("postgresql://user:pass@localhost/qubrix_test")
        == "postgresql+psycopg://user:pass@localhost/qubrix_test"
    )
    assert (
        psycopg_sync_url("postgresql+psycopg://user:pass@localhost/qubrix_test")
        == "postgresql://user:pass@localhost/qubrix_test"
    )


def test_verify_current_database_accepts_exact_match() -> None:
    connection: Connection = Mock(spec=Connection)
    connection.scalar.return_value = "qubrix_test"
    verify_current_database(connection, "qubrix_test")


def test_verify_current_database_rejects_mismatch() -> None:
    connection: Connection = Mock(spec=Connection)
    connection.scalar.return_value = "qubrix_dev"
    with pytest.raises(UnsafeDatabaseTarget, match="does not match"):
        verify_current_database(connection, "qubrix_test")
