from __future__ import annotations

import logging
from collections.abc import Callable
from contextlib import asynccontextmanager
from typing import Annotated, Any

import httpx
from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.auth_dependencies import create_auth_http_client, get_current_principal
from app.core.authorization import require
from app.core.identity import Principal
from app.core.jwt_auth import TokenValidator
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware
from app.core.problems import install_problem_handlers, problem_response
from app.core.settings import Settings, get_settings
from app.db.session import check_database, create_database_engine

logger = logging.getLogger(__name__)
EngineFactory = Callable[[Settings], AsyncEngine]


def create_app(
    settings: Settings | None = None,
    *,
    engine_factory: EngineFactory = create_database_engine,
    jwks_transport: httpx.AsyncBaseTransport | None = None,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        configure_logging()
        active_settings = settings or get_settings()
        application.state.settings = active_settings
        application.state.engine = engine_factory(active_settings)
        application.state.auth_http_client = create_auth_http_client(jwks_transport)
        application.state.token_validator = TokenValidator(
            active_settings, application.state.auth_http_client
        )
        logger.info("Application started")
        try:
            yield
        finally:
            await application.state.auth_http_client.aclose()
            await application.state.engine.dispose()
            logger.info("Application stopped")

    application = FastAPI(
        title="Qubrix",
        version="0.1.0",
        debug=False,
        lifespan=lifespan,
    )
    application.add_middleware(RequestContextMiddleware)
    install_problem_handlers(application)

    @application.get("/health/live", include_in_schema=False)
    async def liveness(request: Request) -> dict[str, str]:
        return {
            "status": "ok",
            "request_id": request.state.request_id,
            "correlation_id": request.state.correlation_id,
        }

    @application.get("/health/ready", include_in_schema=False)
    async def readiness(request: Request) -> Any:
        try:
            await check_database(request.app.state.engine)
        except SQLAlchemyError as error:
            logger.warning(
                "Readiness database check failed: %s",
                type(error).__name__,
                extra={
                    "request_id": request.state.request_id,
                    "error_type": type(error).__name__,
                },
            )
            return problem_response(
                request,
                status=503,
                code="dependency_unavailable",
                title="Service Unavailable",
                detail="A required dependency is unavailable.",
            )
        return JSONResponse(
            {
                "status": "ready",
                "request_id": request.state.request_id,
                "correlation_id": request.state.correlation_id,
            },
            headers={
                "X-Request-ID": request.state.request_id,
                "X-Correlation-ID": request.state.correlation_id,
            },
        )

    @application.get(
        "/api/v1/whoami",
        dependencies=[Depends(require("GET", "/api/v1/whoami"))],
    )
    async def whoami(
        request: Request,
        principal: Annotated[Principal, Depends(get_current_principal)],
    ) -> dict[str, Any]:
        return {
            "request_id": request.state.request_id,
            "subject": principal.subject,
            "organization_id": str(principal.organization_id),
            "roles": sorted(principal.roles),
            "scopes": sorted(principal.scopes),
        }

    return application


app = create_app()
