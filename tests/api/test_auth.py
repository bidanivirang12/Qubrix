from __future__ import annotations

import logging
import re
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock
from uuid import UUID

import httpx
import pytest
from fastapi import FastAPI
from fastapi.routing import APIRoute
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.authorization import (
    ENDPOINT_PERMISSIONS,
    AuthorizationDenied,
    AuthorizationRequirement,
    EndpointPermission,
)
from app.core.identity import Principal
from app.core.settings import Settings
from app.main import create_app

ORG_ID = "6a79d6d8-23d3-4c14-bca7-6621be7d1701"


@asynccontextmanager
async def api_client(
    identity_provider: Any,
    settings: Settings | None = None,
) -> AsyncGenerator[tuple[FastAPI, httpx.AsyncClient], None]:
    engine = AsyncMock(spec=AsyncEngine)
    app = create_app(
        settings or identity_provider.settings(),
        engine_factory=lambda _settings: engine,
        jwks_transport=identity_provider.transport,
    )
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield app, client


@pytest.mark.asyncio
@pytest.mark.parametrize("authorization", [None, "Basic abc", "Bearer"])
async def test_missing_malformed_and_empty_bearer_headers_return_safe_401(
    identity_provider: Any, authorization: str | None
) -> None:
    headers = {} if authorization is None else {"Authorization": authorization}
    async with api_client(identity_provider) as (_, client):
        response = await client.get("/api/v1/whoami", headers=headers)

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["code"] == "unauthenticated"
    assert response.json()["detail"] == "Authentication is required."
    assert "Authorization" not in response.text


@pytest.mark.asyncio
async def test_whoami_returns_validated_principal_and_request_id(identity_provider: Any) -> None:
    token = identity_provider.token(
        claims={"roles": ["ADMIN", "AUDITOR"], "scope": "whoami:read events:read"}
    )
    async with api_client(identity_provider) as (_, client):
        response = await client.get(
            "/api/v1/whoami",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "request_id": response.headers["X-Request-ID"],
        "subject": "tenant-user-17",
        "organization_id": ORG_ID,
        "roles": ["ADMIN", "AUDITOR"],
        "scopes": ["events:read", "whoami:read"],
    }
    assert response.headers["content-type"].startswith("application/json")


@pytest.mark.asyncio
async def test_client_supplied_identity_headers_and_body_are_ignored(
    identity_provider: Any,
) -> None:
    token = identity_provider.token()
    async with api_client(identity_provider) as (_, client):
        response = await client.request(
            "GET",
            "/api/v1/whoami",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Organization-ID": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                "X-Roles": "ADMIN",
                "X-Subject": "attacker",
            },
            json={"organization_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "roles": ["ADMIN"]},
        )

    assert response.status_code == 200
    assert response.json()["organization_id"] == ORG_ID
    assert response.json()["roles"] == ["SERVICE"]
    assert response.json()["subject"] == "tenant-user-17"


@pytest.mark.asyncio
async def test_sufficient_role_without_required_scope_returns_forbidden(
    identity_provider: Any,
) -> None:
    token = identity_provider.token(claims={"roles": ["SERVICE"], "scope": "events:write"})
    async with api_client(identity_provider) as (_, client):
        response = await client.get(
            "/api/v1/whoami",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"
    assert response.headers["content-type"].startswith("application/problem+json")


@pytest.mark.asyncio
async def test_jwks_unavailable_returns_generic_503(identity_provider: Any) -> None:
    identity_provider.status_code = 503
    token = identity_provider.token()
    async with api_client(identity_provider) as (_, client):
        response = await client.get(
            "/api/v1/whoami",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 503
    assert response.json()["code"] == "dependency_unavailable"
    assert "keys" not in response.text.lower()
    assert token not in response.text


@pytest.mark.asyncio
async def test_failed_auth_does_not_log_or_return_token_or_claim_values(
    identity_provider: Any,
    caplog: pytest.LogCaptureFixture,
) -> None:
    secret_value = "sensitive-claim-value-not-for-logs"
    token = identity_provider.token(claims={"sub": secret_value, "roles": ["ROOT"]})
    caplog.set_level(logging.WARNING)
    async with api_client(identity_provider) as (_, client):
        response = await client.get(
            "/api/v1/whoami",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 401
    assert token not in response.text
    assert secret_value not in response.text
    assert token not in caplog.text
    assert secret_value not in caplog.text
    assert "unknown_role" in caplog.text


@pytest.mark.asyncio
async def test_authorization_requires_role_and_scope() -> None:
    requirement = AuthorizationRequirement(
        endpoint=("GET", "/test"),
        permission=EndpointPermission(roles=frozenset({"SERVICE"}), scope="whoami:read"),
    )
    principal_without_scope = Principal(
        subject="subject",
        organization_id=UUID(ORG_ID),
        roles=frozenset({"SERVICE"}),
        scopes=frozenset(),
    )
    principal_without_role = Principal(
        subject="subject",
        organization_id=UUID(ORG_ID),
        roles=frozenset({"AUDITOR"}),
        scopes=frozenset({"whoami:read"}),
    )
    with pytest.raises(AuthorizationDenied):
        await requirement(principal=principal_without_scope)
    with pytest.raises(AuthorizationDenied):
        await requirement(principal=principal_without_role)


def test_every_business_route_has_exactly_one_explicit_permission_requirement(
    identity_provider: Any,
) -> None:
    app = create_app(identity_provider.settings())
    actual: set[tuple[str, str]] = set()
    for route in app.routes:
        if not isinstance(route, APIRoute) or not route.path.startswith("/api/v1/"):
            continue
        for method in route.methods or set():
            endpoint = (method, route.path)
            requirements = [
                dependency.call
                for dependency in route.dependant.dependencies
                if isinstance(dependency.call, AuthorizationRequirement)
            ]
            assert len(requirements) == 1, f"{endpoint} must have exactly one authorization policy"
            assert requirements[0].endpoint == endpoint
            actual.add(endpoint)
    assert actual == set(ENDPOINT_PERMISSIONS)


def test_permissions_for_implemented_routes_match_api_contract() -> None:
    contract = (Path(__file__).parents[2] / "docs" / "api-contracts.md").read_text(encoding="utf-8")
    start = contract.index("## Business endpoints")
    end = contract.index("### Health probes", start)
    endpoint_rows: dict[tuple[str, str], tuple[set[str], str]] = {}
    for line in contract[start:end].splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) != 4:
            continue
        endpoint_match = re.fullmatch(r"`(GET|POST|PATCH|PUT|DELETE) (.+)`", cells[0])
        if endpoint_match is None:
            continue
        endpoint = (endpoint_match.group(1), endpoint_match.group(2))
        roles = set(re.findall(r"`([^`]+)`", cells[2]))
        scope = cells[3].strip("`")
        endpoint_rows[endpoint] = (roles, scope)

    for endpoint, permission in ENDPOINT_PERMISSIONS.items():
        assert endpoint in endpoint_rows
        roles, scope = endpoint_rows[endpoint]
        assert roles == set(permission.roles)
        assert scope == permission.scope
