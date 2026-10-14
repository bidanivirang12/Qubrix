from __future__ import annotations

import asyncio
import os

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from app.core.settings import Settings
from app.db.base import Base
from app.db.connection import psycopg_async_url
from app.db.safety import require_test_database, verify_current_database

config = context.config
target_metadata = Base.metadata


def migration_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        raise RuntimeError("TEST_DATABASE_URL must be set for Alembic migrations")
    require_test_database(
        url,
        allow_nonlocal_host=Settings().allow_nonlocal_test_database_host,
    )
    return psycopg_async_url(url)


def run_migrations_offline() -> None:
    context.configure(
        url=migration_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    test_database_url = os.environ.get("TEST_DATABASE_URL")
    if not test_database_url:
        raise RuntimeError("TEST_DATABASE_URL must be set for Alembic migrations")
    expected_database = require_test_database(
        test_database_url,
        allow_nonlocal_host=Settings().allow_nonlocal_test_database_host,
    )
    section = config.get_section(config.config_ini_section, {})
    section["sqlalchemy.url"] = migration_url()
    connectable = async_engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args={"options": "-c statement_timeout=10000"},
    )
    async with connectable.connect() as connection:
        await connection.run_sync(verify_current_database, expected_database)
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations(), loop_factory=asyncio.SelectorEventLoop)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
