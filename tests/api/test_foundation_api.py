from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from pydantic import BaseModel

from app.core.settings import Settings
from app.main import create_app


def settings_for(database_url: str) -> Settings:
    return Settings.model_validate({"environment": "test", "runtime_database_url": database_url})


@asynccontextmanager
async def client_for(application: FastAPI) -> AsyncGenerator[httpx.AsyncClient, None]:
    async with application.router.lifespan_context(application):
        transport = httpx.ASGITransport(app=application, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client


@pytest.mark.asyncio
async def test_liveness_has_request_and_correlation_ids() -> None:
    application = create_app(settings_for("postgresql+psycopg://test:test@localhost/qubrix_test"))
    async with client_for(application) as client:
        response = await client.get(
            "/health/live", headers={"X-Correlation-ID": "d7ff457f-908d-4815-b237-e57287fbd70d"}
        )

    assert response.status_code == 200
    assert response.json()["request_id"] == response.headers["X-Request-ID"]
    assert response.json()["correlation_id"] == "d7ff457f-908d-4815-b237-e57287fbd70d"
    assert response.headers["X-Correlation-ID"] == response.json()["correlation_id"]


@pytest.mark.asyncio
async def test_readiness_returns_problem_when_database_is_down() -> None:
    application = create_app(settings_for("postgresql+psycopg://test:test@127.0.0.1:1/qubrix_test"))
    async with client_for(application) as client:
        response = await client.get("/health/ready")

    assert response.status_code == 503
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["code"] == "dependency_unavailable"
    assert response.json()["request_id"] == response.headers["X-Request-ID"]
    assert "127.0.0.1" not in response.text


@pytest.mark.asyncio
async def test_validation_error_is_rfc9457_400() -> None:
    application = create_app(settings_for("postgresql+psycopg://test:test@localhost/qubrix_test"))

    class Payload(BaseModel):
        value: int

    @application.post("/test-validation")
    async def validate_payload(payload: Payload) -> dict[str, int]:
        return {"value": payload.value}

    async with client_for(application) as client:
        response = await client.post("/test-validation", json={"value": "not-an-int"})

    assert response.status_code == 400
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["type"] == "about:blank"
    assert response.json()["code"] == "invalid_request"
    assert response.json()["request_id"] == response.headers["X-Request-ID"]
    assert "not-an-int" not in response.text
    assert "traceback" not in response.text.lower()


@pytest.mark.asyncio
async def test_unexpected_error_does_not_expose_exception() -> None:
    application = create_app(settings_for("postgresql+psycopg://test:test@localhost/qubrix_test"))

    @application.get("/test-error")
    async def explode() -> Any:
        raise RuntimeError("private implementation detail")

    async with client_for(application) as client:
        response = await client.get("/test-error")

    assert response.status_code == 500
    assert response.headers["content-type"].startswith("application/problem+json")
    assert "private implementation detail" not in response.text
