import pytest

from app.db.safety import UnsafeDatabaseTarget, database_name, require_test_database


def test_database_name_parses_psycopg_url() -> None:
    assert (
        database_name("postgresql+psycopg://test-user:secret@localhost:5432/qubrix_test")
        == "qubrix_test"
    )


def test_guard_accepts_only_database_names_ending_with_test() -> None:
    assert (
        require_test_database("postgresql://user:secret@localhost:5432/integration_test")
        == "integration_test"
    )
    with pytest.raises(UnsafeDatabaseTarget, match="must end with _test"):
        require_test_database("postgresql://user:secret@localhost:5432/qubrix_dev")


def test_guard_rejects_missing_database_name() -> None:
    with pytest.raises(UnsafeDatabaseTarget, match="does not contain a database name"):
        require_test_database("postgresql://user:secret@localhost:5432/")
