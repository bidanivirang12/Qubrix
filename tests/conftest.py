from __future__ import annotations

import asyncio
import os
import sys
from typing import Any

import pytest
from sqlalchemy import create_engine

from app.core.settings import Settings
from app.db.connection import psycopg_sync_url
from app.db.safety import (
    UnsafeDatabaseTarget,
    require_test_database,
    verify_current_database,
)


def pytest_sessionstart(session: Any) -> None:
    del session
    if sys.platform == "win32":
        # Psycopg's async driver does not support ProactorEventLoop on Windows.
        asyncio.set_event_loop_policy(  # pyright: ignore[reportDeprecated]
            asyncio.WindowsSelectorEventLoopPolicy()
        )
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.exit("TEST_DATABASE_URL is required; refusing to run tests", returncode=4)
    try:
        require_test_database(
            url,
            allow_nonlocal_host=Settings().allow_nonlocal_test_database_host,
        )
    except UnsafeDatabaseTarget as error:
        pytest.exit(str(error), returncode=4)


@pytest.fixture(scope="session", autouse=True)
def verify_test_database_connection() -> None:
    url = os.environ["TEST_DATABASE_URL"]
    expected_database = require_test_database(
        url,
        allow_nonlocal_host=Settings().allow_nonlocal_test_database_host,
    )
    engine = create_engine(psycopg_sync_url(url), pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            verify_current_database(connection, expected_database)
    finally:
        engine.dispose()
