from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from psycopg import sql as psycopg_sql
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.settings import Settings
from app.db.connection import psycopg_async_url, psycopg_sync_url
from app.db.safety import UnsafeDatabaseTarget, require_test_database, verify_current_database


def validated_test_database_name(database_url: str) -> str:
    return require_test_database(
        database_url,
        allow_nonlocal_host=Settings().allow_nonlocal_test_database_host,
    )


def test_migration_persists_on_a_fresh_scratch_database() -> None:
    admin_url = os.environ.get("TEST_DATABASE_ADMIN_URL")
    if not admin_url:
        pytest.skip("TEST_DATABASE_ADMIN_URL is required to create an isolated scratch database")

    owner_url = os.environ["TEST_DATABASE_URL"]
    validated_test_database_name(owner_url)
    admin_parsed = make_url(admin_url)
    if (
        admin_parsed.host not in {"localhost", "127.0.0.1", "::1"}
        or admin_parsed.database != "postgres"
    ):
        pytest.fail("scratch database administrator URL must target local postgres")

    database_name = f"qubrix_migration_{uuid4().hex}_test"
    scratch_url = (
        make_url(owner_url).set(database=database_name).render_as_string(hide_password=False)
    )
    validated_test_database_name(scratch_url)
    created = False
    try:
        with psycopg.connect(psycopg_sync_url(admin_url), autocommit=True) as connection:
            connected_database = connection.execute("SELECT current_database()").fetchone()
            assert connected_database is not None
            if connected_database[0] != admin_parsed.database:
                pytest.fail("scratch database administrator URL reached an unexpected database")
            connection.execute(
                psycopg_sql.SQL("CREATE DATABASE {} OWNER qubrix_app").format(
                    psycopg_sql.Identifier(database_name)
                )
            )
            created = True
            connection.execute(
                psycopg_sql.SQL("REVOKE ALL ON DATABASE {} FROM PUBLIC").format(
                    psycopg_sql.Identifier(database_name)
                )
            )
            connection.execute(
                psycopg_sql.SQL("GRANT CONNECT ON DATABASE {} TO qubrix_runtime").format(
                    psycopg_sql.Identifier(database_name)
                )
            )

        scratch_admin_url = (
            make_url(admin_url).set(database=database_name).render_as_string(hide_password=False)
        )
        with psycopg.connect(psycopg_sync_url(scratch_admin_url), autocommit=True) as connection:
            connection.execute(psycopg_sql.SQL("GRANT USAGE ON SCHEMA public TO qubrix_runtime"))

        migration_environment = os.environ.copy()
        migration_environment["TEST_DATABASE_URL"] = scratch_url
        migration_environment.pop("QUBRIX_ALLOW_NONLOCAL_TEST_DATABASE_HOST", None)
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=Path(__file__).resolve().parents[2],
            env=migration_environment,
            capture_output=True,
            text=True,
            check=False,
            timeout=90,
        )
        assert result.returncode == 0, (
            "Alembic failed against the isolated scratch database; output redacted"
        )

        expected_privileges: dict[str, set[str]] = {
            "alembic_version": set(),
            "audit_records": {"SELECT", "INSERT"},
            "organizations": {"SELECT", "INSERT", "UPDATE"},
        }
        all_privileges = {
            "SELECT",
            "INSERT",
            "UPDATE",
            "DELETE",
            "TRUNCATE",
            "REFERENCES",
            "TRIGGER",
        }
        with psycopg.connect(psycopg_sync_url(scratch_url)) as connection:
            connected_database = connection.execute("SELECT current_database()").fetchone()
            assert connected_database is not None
            if connected_database[0] != database_name:
                pytest.fail("migration verification connected to an unexpected database")
            tables = {
                row[0]
                for row in connection.execute(
                    "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'"
                )
            }
            assert tables == set(expected_privileges)

            actual_privileges: dict[str, set[str]] = {}
            for table_name in expected_privileges:
                actual_privileges[table_name] = set()
                for privilege in all_privileges:
                    privilege_row = connection.execute(
                        "SELECT has_table_privilege(%s, %s, %s)",
                        ("qubrix_runtime", f"public.{table_name}", privilege),
                    ).fetchone()
                    assert privilege_row is not None
                    if privilege_row[0]:
                        actual_privileges[table_name].add(privilege)
            assert actual_privileges == expected_privileges
    finally:
        if created:
            with psycopg.connect(psycopg_sync_url(admin_url), autocommit=True) as connection:
                connection.execute(
                    psycopg_sql.SQL("DROP DATABASE {} WITH (FORCE)").format(
                        psycopg_sql.Identifier(database_name)
                    )
                )


@pytest.mark.asyncio
async def test_runtime_table_privileges_match_explicit_allowlist() -> None:
    database_url = os.environ["TEST_DATABASE_URL"]
    validated_test_database_name(database_url)
    engine = create_async_engine(psycopg_async_url(database_url), pool_pre_ping=True)
    expected_table_privileges: dict[str, set[str]] = {
        "alembic_version": set(),
        "audit_records": {"SELECT", "INSERT"},
        "organizations": {"SELECT", "INSERT", "UPDATE"},
    }
    privileges: tuple[str, ...] = (
        "SELECT",
        "INSERT",
        "UPDATE",
        "DELETE",
        "TRUNCATE",
        "REFERENCES",
        "TRIGGER",
    )
    try:
        async with engine.connect() as connection:
            table_rows = await connection.execute(
                text(
                    "SELECT tablename FROM pg_catalog.pg_tables "
                    "WHERE schemaname = 'public' ORDER BY tablename"
                )
            )
            table_names: set[str] = {str(row[0]) for row in table_rows}
            actual_table_privileges: dict[str, set[str]] = {
                table_name: set() for table_name in table_names
            }
            for table_name in table_names:
                for privilege in privileges:
                    has_privilege = await connection.scalar(
                        text(
                            "SELECT has_table_privilege("
                            "'qubrix_runtime', "
                            "format('%I.%I', 'public', CAST(:table_name AS text)), "
                            "CAST(:privilege AS text))"
                        ),
                        {"table_name": table_name, "privilege": privilege},
                    )
                    if has_privilege:
                        actual_table_privileges[table_name].add(privilege)

            assert actual_table_privileges == expected_table_privileges

            inherited_table_privileges = await connection.scalar(
                text(
                    "SELECT EXISTS ("
                    "SELECT 1 FROM pg_catalog.pg_default_acl AS defaults "
                    "JOIN pg_catalog.pg_roles AS owner "
                    "ON owner.oid = defaults.defaclrole "
                    "CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS acl "
                    "JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee "
                    "WHERE owner.rolname = 'qubrix_app' "
                    "AND defaults.defaclnamespace = 'public'::regnamespace "
                    "AND defaults.defaclobjtype = 'r' "
                    "AND grantee.rolname = 'qubrix_runtime')"
                )
            )
            assert not inherited_table_privileges

            sequence_rows = await connection.execute(
                text(
                    "SELECT sequencename FROM pg_catalog.pg_sequences "
                    "WHERE schemaname = 'public' ORDER BY sequencename"
                )
            )
            for (sequence_name_value,) in sequence_rows:
                sequence_name = str(sequence_name_value)
                for privilege in ("USAGE", "SELECT", "UPDATE"):
                    has_privilege = await connection.scalar(
                        text(
                            "SELECT has_sequence_privilege("
                            "'qubrix_runtime', "
                            "format('%I.%I', 'public', CAST(:sequence_name AS text)), "
                            "CAST(:privilege AS text))"
                        ),
                        {"sequence_name": sequence_name, "privilege": privilege},
                    )
                    assert not has_privilege, (
                        f"unexpected {privilege} privilege on public sequence {sequence_name}"
                    )

            inherited_sequence_privileges = await connection.scalar(
                text(
                    "SELECT EXISTS ("
                    "SELECT 1 FROM pg_catalog.pg_default_acl AS defaults "
                    "JOIN pg_catalog.pg_roles AS owner "
                    "ON owner.oid = defaults.defaclrole "
                    "CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS acl "
                    "JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee "
                    "WHERE owner.rolname = 'qubrix_app' "
                    "AND defaults.defaclnamespace = 'public'::regnamespace "
                    "AND defaults.defaclobjtype = 'S' "
                    "AND grantee.rolname = 'qubrix_runtime')"
                )
            )
            assert not inherited_sequence_privileges
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_migrated_empty_database_has_foundation_tables() -> None:
    database_url = os.environ["TEST_DATABASE_URL"]
    validated_test_database_name(database_url)
    engine = create_async_engine(psycopg_async_url(database_url), pool_pre_ping=True)
    try:
        async with engine.connect() as connection:
            await connection.run_sync(verify_current_database, "qubrix_test")
            rows = await connection.execute(
                text(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = 'public' "
                    "AND table_name IN ('organizations', 'audit_records', 'alembic_version')"
                )
            )
            assert {row[0] for row in rows} == {
                "organizations",
                "audit_records",
                "alembic_version",
            }
            revision = await connection.scalar(text("SELECT version_num FROM alembic_version"))
            assert revision == "0002_runtime_table_privileges"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_post_connection_database_check_rejects_mismatched_name() -> None:
    database_url = os.environ["TEST_DATABASE_URL"]
    validated_test_database_name(database_url)
    engine = create_async_engine(psycopg_async_url(database_url), pool_pre_ping=True)
    try:
        async with engine.connect() as connection:
            with pytest.raises(UnsafeDatabaseTarget, match="does not match"):
                await connection.run_sync(verify_current_database, "qubrix_wrong_test")
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_runtime_role_cannot_update_or_delete_audit_records() -> None:
    database_url = os.environ.get("RUNTIME_TEST_DATABASE_URL")
    if not database_url:
        pytest.fail("RUNTIME_TEST_DATABASE_URL is required for the audit permission test")
    validated_test_database_name(database_url)
    engine = create_async_engine(psycopg_async_url(database_url), pool_pre_ping=True)
    tenant_ref = f"foundation-audit-test-{uuid4()}"
    try:
        async with engine.begin() as connection:
            await connection.run_sync(verify_current_database, "qubrix_test")
            grants = await connection.execute(
                text(
                    "SELECT "
                    "has_table_privilege(current_user, 'audit_records', 'SELECT'), "
                    "has_table_privilege(current_user, 'audit_records', 'INSERT'), "
                    "has_table_privilege(current_user, 'audit_records', 'UPDATE'), "
                    "has_table_privilege(current_user, 'audit_records', 'DELETE'), "
                    "has_table_privilege(current_user, 'audit_records', 'TRUNCATE')"
                )
            )
            assert grants.one() == (True, True, False, False, False)
            organization_id = await connection.scalar(
                text(
                    "INSERT INTO organizations (id, external_tenant_ref, state) "
                    "VALUES (:organization_id, :tenant_ref, 'ACTIVE') "
                    "RETURNING id"
                ),
                {"organization_id": uuid4(), "tenant_ref": tenant_ref},
            )
            audit_id = await connection.scalar(
                text(
                    "INSERT INTO audit_records "
                    "(id, organization_id, actor_subject, action, target_ref) "
                    "VALUES (:audit_id, :organization_id, 'test-actor', "
                    "'foundation.test', 'audit-test') RETURNING id"
                ),
                {"audit_id": uuid4(), "organization_id": organization_id},
            )
        for statement in (
            "UPDATE audit_records SET action = 'tampered' WHERE id = :audit_id",
            "DELETE FROM audit_records WHERE id = :audit_id",
        ):
            with pytest.raises(DBAPIError) as error:
                async with engine.begin() as connection:
                    await connection.execute(text(statement), {"audit_id": audit_id})
            assert "permission denied" in str(error.value).lower()
        async with engine.connect() as connection:
            count = await connection.scalar(
                text("SELECT count(*) FROM audit_records WHERE id = :audit_id"),
                {"audit_id": audit_id},
            )
            assert count == 1
    finally:
        await engine.dispose()
