from __future__ import annotations

import asyncio
import os
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.identity import Principal
from app.core.post_auth_limiter import consume_post_auth_budget
from app.core.settings import Settings
from app.db.connection import psycopg_async_url
from app.db.safety import require_test_database, verify_current_database


@pytest.mark.asyncio
async def test_postgres_rate_counter_is_atomic_under_concurrent_requests() -> None:
    database_url = os.environ["TEST_DATABASE_URL"]
    expected_database = require_test_database(
        database_url,
        allow_nonlocal_host=Settings().allow_nonlocal_test_database_host,
    )
    engine = create_async_engine(psycopg_async_url(database_url), pool_pre_ping=True)
    organization_id = uuid4()
    tenant_ref = f"rate-limit-concurrency-{uuid4()}"
    principal = Principal(
        subject=f"rate-limit-subject-{uuid4()}",
        organization_id=organization_id,
        roles=frozenset({"SERVICE"}),
        scopes=frozenset(),
        issued_at=1_000,
    )
    settings = Settings(environment="test")
    try:
        async with engine.begin() as connection:
            await connection.run_sync(verify_current_database, expected_database)
            await connection.execute(
                text(
                    "INSERT INTO organizations (id, external_tenant_ref, state) "
                    "VALUES (:id, :tenant_ref, 'ACTIVE')"
                ),
                {"id": organization_id, "tenant_ref": tenant_ref},
            )

        results = await asyncio.gather(
            *(
                consume_post_auth_budget(
                    engine,
                    settings,
                    principal,
                    "human_reads",
                    10,
                    clock=lambda: 120.5,
                )
                for _ in range(50)
            )
        )
        assert sum(result is None for result in results) == 10
        assert sum(result is not None for result in results) == 40

        async with engine.connect() as connection:
            count = await connection.scalar(
                text(
                    "SELECT request_count FROM rate_limit_windows "
                    "WHERE organization_id = :organization_id AND subject = :subject "
                    "AND route_class = 'human_reads'"
                ),
                {"organization_id": organization_id, "subject": principal.subject},
            )
            assert count == 50
    finally:
        async with engine.begin() as connection:
            await connection.execute(
                text("DELETE FROM rate_limit_windows WHERE organization_id = :id"),
                {"id": organization_id},
            )
            await connection.execute(
                text("DELETE FROM identity_status WHERE organization_id = :id"),
                {"id": organization_id},
            )
            await connection.execute(
                text("DELETE FROM organizations WHERE id = :id"),
                {"id": organization_id},
            )
        await engine.dispose()
