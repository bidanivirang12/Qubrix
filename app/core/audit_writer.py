from __future__ import annotations

import logging
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.identity import Principal
from app.core.post_auth_limiter import consume_post_auth_budget, quota_for_route
from app.core.security_telemetry import SecurityTelemetry
from app.core.settings import Settings

logger = logging.getLogger(__name__)


async def record_auth_denial(
    engine: AsyncEngine,
    settings: Settings,
    principal: Principal,
    *,
    action: str,
    endpoint_route_class: str,
    telemetry: SecurityTelemetry,
    address: str | None,
) -> None:
    try:
        retry_after = await consume_post_auth_budget(
            engine,
            settings,
            principal,
            "audit_denial",
            quota_for_route(settings, "audit_denial"),
        )
        if retry_after is not None:
            telemetry.record("authorization_denial_limit", address)
            return
        async with engine.begin() as connection:
            await connection.execute(
                text(
                    "INSERT INTO audit_records "
                    "(id, organization_id, actor_subject, action, target_ref) "
                    "VALUES (:id, :organization_id, :actor_subject, :action, :target_ref)"
                ),
                {
                    "id": uuid4(),
                    "organization_id": principal.organization_id,
                    "actor_subject": principal.subject,
                    "action": action,
                    "target_ref": endpoint_route_class,
                },
            )
    except SQLAlchemyError as error:
        logger.error(
            "Authentication denial audit write failed",
            extra={
                "security_event": "audit_write_failure",
                "error_category": type(error).__name__,
            },
        )
