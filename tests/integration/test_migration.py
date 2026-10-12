from __future__ import annotations

import os
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.safety import psycopg_async_url, require_test_database


@pytest.mark.asyncio
async def test_migrated_empty_database_has_foundation_tables() -> None:
    database_url = os.environ["TEST_DATABASE_URL"]
    require_test_database(database_url)
    engine = create_async_engine(psycopg_async_url(database_url), pool_pre_ping=True)
    try:
        async with engine.connect() as connection:
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
            assert revision == "0001_organizations_audit"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_runtime_role_cannot_update_or_delete_audit_records() -> None:
    database_url = os.environ.get("RUNTIME_TEST_DATABASE_URL")
    if not database_url:
        pytest.fail("RUNTIME_TEST_DATABASE_URL is required for the audit permission test")
    require_test_database(database_url)
    engine = create_async_engine(psycopg_async_url(database_url), pool_pre_ping=True)
    tenant_ref = f"foundation-audit-test-{uuid4()}"
    try:
        async with engine.begin() as connection:
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
