from __future__ import annotations

import math
import time
from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.identity import Principal
from app.core.settings import Settings

QUOTA_SETTINGS = {
    "service_events": "service_events_per_minute",
    "crypto_requests": "crypto_requests_per_minute",
    "human_reads": "human_reads_per_minute",
    "human_writes": "human_writes_per_minute",
    "audit_denial": "audit_denial_rows_per_subject_per_minute",
}


class RateLimitExceeded(Exception):
    def __init__(self, retry_after: int) -> None:
        self.retry_after = max(1, retry_after)
        super().__init__(self.retry_after)


def quota_for_route(settings: Settings, route_class: str) -> int:
    setting_name = QUOTA_SETTINGS.get(route_class)
    if setting_name is None:
        raise ValueError(f"Unknown endpoint route class: {route_class}")
    return int(getattr(settings, setting_name))


async def consume_post_auth_budget(
    engine: AsyncEngine,
    settings: Settings,
    principal: Principal,
    route_class: str,
    quota: int,
    *,
    clock: Callable[[], float] = time.time,
) -> int | None:
    window_seconds = settings.rate_limit_window_seconds
    now = clock()
    start_epoch = math.floor(now / window_seconds) * window_seconds
    window_start = datetime.fromtimestamp(start_epoch, tz=UTC)
    retry_after = max(1, math.ceil(start_epoch + window_seconds - now))
    statement = text(
        "INSERT INTO rate_limit_windows "
        "(organization_id, subject, route_class, window_start, request_count) "
        "VALUES (:organization_id, :subject, :route_class, :window_start, 1) "
        "ON CONFLICT (organization_id, subject, route_class, window_start) "
        "DO UPDATE SET request_count = rate_limit_windows.request_count + 1 "
        "RETURNING request_count"
    )
    async with engine.begin() as connection:
        count = await connection.scalar(
            statement,
            {
                "organization_id": principal.organization_id,
                "subject": principal.subject,
                "route_class": route_class,
                "window_start": window_start,
            },
        )
    if count is None:
        raise RuntimeError("The rate limiter did not return its atomic counter")
    return retry_after if int(count) > quota else None


async def cleanup_expired_windows(
    engine: AsyncEngine,
    settings: Settings,
    *,
    clock: Callable[[], float] = time.time,
) -> int:
    cutoff = datetime.fromtimestamp(
        clock() - settings.rate_limit_retention_seconds,
        tz=UTC,
    )
    async with engine.begin() as connection:
        result = await connection.execute(
            text("DELETE FROM rate_limit_windows WHERE window_start < :cutoff"),
            {"cutoff": cutoff},
        )
    return int(result.rowcount or 0)
