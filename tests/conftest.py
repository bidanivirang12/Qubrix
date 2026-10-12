from __future__ import annotations

import asyncio
import os
import sys
from typing import Any

import pytest

from app.db.safety import UnsafeDatabaseTarget, require_test_database


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
        require_test_database(url)
    except UnsafeDatabaseTarget as error:
        pytest.exit(str(error), returncode=4)
