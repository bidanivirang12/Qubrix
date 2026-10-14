from __future__ import annotations

import re
from pathlib import Path


def test_database_bootstrap_does_not_grant_table_or_sequence_privileges() -> None:
    script = (Path(__file__).parents[2] / "scripts" / "bootstrap_db.sql").read_text(
        encoding="utf-8"
    )
    assert not re.search(r"\bALTER\s+DEFAULT\s+PRIVILEGES\b", script, re.IGNORECASE)
    assert not re.search(
        r"\bGRANT\b[^\n;]*\bON\s+(?:ALL\s+)?(?:TABLES|SEQUENCES?)\b",
        script,
        re.IGNORECASE,
    )
    assert not re.search(r"^\s*\\quit\b", script, re.IGNORECASE | re.MULTILINE)


def test_database_bootstrap_revokes_public_connect_and_validates_names_in_sql() -> None:
    script = (Path(__file__).parents[2] / "scripts" / "bootstrap_db.sql").read_text(
        encoding="utf-8"
    )
    assert script.count("REVOKE ALL PRIVILEGES ON DATABASE %I FROM PUBLIC") == 2
    assert script.count("GRANT CONNECT ON DATABASE %I TO qubrix_app") == 2
    assert script.count("GRANT CONNECT ON DATABASE %I TO qubrix_runtime") == 2
    assert script.count("GRANT USAGE ON SCHEMA public TO qubrix_runtime") == 2
    assert "\\set ON_ERROR_STOP on" in script
    assert "DO $$" in script
    assert "RAISE EXCEPTION" in script
