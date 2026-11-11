from __future__ import annotations

import asyncio
import re
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast
from uuid import UUID

import httpx
import pytest
from fastapi import FastAPI
from fastapi.routing import APIRoute
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine
from app.core.authorization import (
    ENDPOINT_PERMISSIONS,
    AuthorizationDenied,
    AuthorizationRequirement,
    EndpointPermission,
)
from app.core.identity import Principal
from app.core.security_telemetry import SecurityTelemetry
from app.core.settings import Settings
from app.main import create_app

ORG_ID = "6a79d6d8-23d3-4c14-bca7-6621be7d1701"


class _FakeResult:
    def __init__(self, value: Any = None) -> None:
        self.value = value

    def one_or_none(self) -> Any:
        return self.value


class _FakeConnection:
    def __init__(self, engine: _FakeEngine) -> None:
        self.engine = engine

    async def scalar(self, statement: Any, parameters: dict[str, Any] | None = None) -> Any:
        self.engine.query_count += 1
        query = str(statement)
        if self.engine.database_error:
            raise SQLAlchemyError("database unavailable")
        if "SELECT state FROM organizations" in query:
            return self.engine.organization_state
        if "INSERT INTO rate_limit_windows" in query:
            assert parameters is not None
            key = (
                parameters["organization_id"],
                parameters["subject"],
                parameters["route_class"],
                parameters["window_start"],
            )
            async with self.engine.counter_lock:
                self.engine.counters[key] = self.engine.counters.get(key, 0) + 1
                return self.engine.counters[key]
        return None

    async def execute(self, statement: Any, parameters: dict[str, Any] | None = None) -> _FakeResult:
        self.engine.query_count += 1
        query = str(statement)
        if "FROM identity_status" in query:
            return _FakeResult(self.engine.subject_status)
        if "INSERT INTO audit_records" in query:
            if self.engine.audit_failure:
                raise SQLAlchemyError("audit insert failed")
            assert parameters is not None
            self.engine.audit_records.append(parameters)
        return _FakeResult()


class _FakeConnectionContext:
    def __init__(self, engine: _FakeEngine) -> None:
        self.connection = _FakeConnection(engine)

    async def __aenter__(self) -> _FakeConnection:
        return self.connection

    async def __aexit__(self, *_args: Any) -> None:
        return None


class _FakeEngine:
    def __init__(self) -> None:
        self.organization_state: str | None = "ACTIVE"
        self.subject_status: Any = None
        self.counters: dict[tuple[Any, ...], int] = {}
        self.audit_records: list[dict[str, Any]] = []
        self.query_count = 0
        self.counter_lock = asyncio.Lock()
        self.database_error = False
        self.audit_failure = False

    def connect(self) -> _FakeConnectionContext:
        return _FakeConnectionContext(self)

    def begin(self) -> _FakeConnectionContext:
        return _FakeConnectionContext(self)

    async def dispose(self) -> None:
        return None


def _as_engine(engine: _FakeEngine) -> AsyncEngine:
    return cast(AsyncEngine, engine)


@asynccontextmanager
async def api_client(
    identity_provider: Any,
    settings: Settings | None = None,
) -> AsyncGenerator[tuple[FastAPI, httpx.AsyncClient], None]:
    engine = _FakeEngine()
    app = create_app(
        settings or identity_provider.settings(),
        engine_factory=lambda _settings: _as_engine(engine),
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
    async with api_client(identity_provider) as (app, client):
        response = await client.get(
            "/api/v1/whoami",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"
    assert response.headers["content-type"].startswith("application/problem+json")
    audit_rows = app.state.engine.audit_records
    assert len(audit_rows) == 1
    assert audit_rows[0]["organization_id"] == UUID(ORG_ID)
    assert audit_rows[0]["actor_subject"] == "tenant-user-17"
    assert token not in str(audit_rows[0])
    assert "127.0.0.1" not in str(audit_rows[0])
    assert "events:write" not in str(audit_rows[0])


@pytest.mark.asyncio
async def test_disabled_subject_is_denied_and_audited(identity_provider: Any) -> None:
    token = identity_provider.token()
    async with api_client(identity_provider) as (app, client):
        app.state.engine.subject_status = SimpleNamespace(
            disabled_at=datetime.now(UTC),
            tokens_valid_after=None,
        )
        response = await client.get(
            "/api/v1/whoami",
            headers={"Authorization": f"******"},
        )

    assert response.status_code == 403
    assert app.state.engine.audit_records[0]["action"] == "auth.subject_disabled"
    assert len(app.state.engine.audit_records) == 1
    assert token not in str(app.state.engine.audit_records)


@pytest.mark.asyncio
async def test_tokens_valid_after_revokes_older_tokens(identity_provider: Any) -> None:
    issued_at = int(identity_provider.wall_time) - 1
    async with api_client(identity_provider) as (app, client):
        app.state.engine.subject_status = SimpleNamespace(
            disabled_at=None,
            tokens_valid_after=datetime.fromtimestamp(issued_at + 1, tz=UTC),
        )
        old_token = identity_provider.token(claims={"iat": issued_at})
        denied = await client.get(
            "/api/v1/whoami",
            headers={"Authorization": f"******"},
        )
        assert denied.status_code == 403

    async with api_client(identity_provider) as (app, client):
        app.state.engine.subject_status = SimpleNamespace(
            disabled_at=None,
            tokens_valid_after=datetime.fromtimestamp(issued_at - 1, tz=UTC),
        )
        new_token = identity_provider.token(claims={"iat": issued_at})
        accepted = await client.get(
            "/api/v1/whoami",
            headers={"Authorization": f"******"},
        )

    assert accepted.status_code == 200
    assert old_token not in denied.text
    assert new_token not in accepted.text


@pytest.mark.asyncio
async def test_unprovisioned_organization_is_denied_without_audit(
    identity_provider: Any,
) -> None:
    token = identity_provider.token(
        claims={"organization_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}
    )
    async with api_client(identity_provider) as (app, client):
        app.state.engine.organization_state = None
        response = await client.get(
            "/api/v1/whoami",
            headers={"Authorization": f"******"},
        )

    assert response.status_code == 403
    assert app.state.engine.audit_records == []
    assert token not in response.text


@pytest.mark.asyncio
async def test_identity_database_failure_returns_503(identity_provider: Any) -> None:
    token = identity_provider.token()
    async with api_client(identity_provider) as (app, client):
        app.state.engine.database_error = True
        response = await client.get(
            "/api/v1/whoami",
            headers={"Authorization": f"******"},
        )

    assert response.status_code == 503
    assert response.json()["code"] == "dependency_unavailable"
    assert token not in response.text


@pytest.mark.asyncio
async def test_audit_insert_failure_does_not_change_denial(identity_provider: Any) -> None:
    token = identity_provider.token(claims={"scope": "events:write"})
    async with api_client(identity_provider) as (app, client):
        app.state.engine.audit_failure = True
        response = await client.get(
            "/api/v1/whoami",
            headers={"Authorization": f"******"},
        )

    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"
    assert app.state.engine.audit_records == []
    assert token not in response.text


@pytest.mark.asyncio
async def test_denial_flood_is_bounded_per_subject(identity_provider: Any) -> None:
    settings = identity_provider.settings(audit_denial_rows_per_subject_per_minute=3)
    async with api_client(identity_provider, settings) as (app, client):
        token = identity_provider.token(claims={"scope": "events:write"})
        responses = []
        for _ in range(10):
            responses.append(
                await client.get(
                    "/api/v1/whoami",
                    headers={"Authorization": f"******"},
                )
            )

    assert all(response.status_code == 403 for response in responses)
    assert len(app.state.engine.audit_records) == 3


@pytest.mark.asyncio
async def test_bad_token_flood_never_queries_database_and_telemetry_is_bounded(
    identity_provider: Any,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async with api_client(identity_provider) as (app, client):
        responses = []
        for _ in range(1_000):
            responses.append(
                await client.get(
                    "/api/v1/whoami",
                    headers={"Authorization": "Bearer not-a-jwt"},
                )
            )

    assert all(response.status_code in {401, 429} for response in responses)
    assert app.state.engine.query_count == 0
    captured = capsys.readouterr()
    lines = (captured.out + captured.err).splitlines()
    telemetry_lines = [line for line in lines if "Authentication security telemetry" in line]
    assert len(telemetry_lines) <= 2
    assert "not-a-jwt" not in captured.out + captured.err


@pytest.mark.asyncio
async def test_post_auth_quota_returns_problem_with_retry_after(identity_provider: Any) -> None:
    settings = identity_provider.settings(human_reads_per_minute=1)
    token = identity_provider.token()
    async with api_client(identity_provider, settings) as (_, client):
        first = await client.get(
            "/api/v1/whoami",
            headers={"Authorization": f"******"},
        )
        second = await client.get(
            "/api/v1/whoami",
            headers={"Authorization": f"******"},
        )

    assert first.status_code == 200
    assert second.status_code == 429
    assert int(second.headers["Retry-After"]) >= 1
    assert second.headers["content-type"].startswith("application/problem+json")
    assert second.json()["code"] == "rate_limited"
    assert token not in second.text


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
    capsys: pytest.CaptureFixture[str],
) -> None:
    secret_value = "sensitive-claim-value-not-for-logs"
    token = identity_provider.token(claims={"sub": secret_value, "roles": ["ROOT"]})
    async with api_client(identity_provider) as (_, client):
        response = await client.get(
            "/api/v1/whoami",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 401
    assert token not in response.text
    assert secret_value not in response.text
    captured = capsys.readouterr()
    combined = captured.out + captured.err
    assert token not in combined
    assert secret_value not in combined
    assert "invalid_token" in combined


@pytest.mark.asyncio
async def test_authorization_requires_role_and_scope() -> None:
    engine = _FakeEngine()
    request = SimpleNamespace(
        client=None,
        app=SimpleNamespace(
            state=SimpleNamespace(
                engine=engine,
                settings=Settings(environment="test"),
                security_telemetry=SecurityTelemetry(b"test-address-hash-salt"),
            )
        ),
    )
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
        await requirement(request=request, principal=principal_without_scope)
    with pytest.raises(AuthorizationDenied):
        await requirement(request=request, principal=principal_without_role)
    assert len(engine.audit_records) == 2


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
