from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from collections.abc import AsyncGenerator
from typing import Any

import httpx
import jwt
import pytest
import pytest_asyncio
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from sqlalchemy import create_engine

from app.core.jwt_auth import TokenValidator
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


class TestIdentityProvider:
    def __init__(self) -> None:
        self.rsa_private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.ec_private = ec.generate_private_key(ec.SECP256R1())
        self.rsa_key = self._public_jwk(self.rsa_private.public_key(), "rsa-1", "RS256")
        self.ec_key = self._public_jwk(self.ec_private.public_key(), "ec-1", "ES256")
        self.keys: list[dict[str, Any]] = [self.rsa_key, self.ec_key]
        self.requests: list[httpx.Request] = []
        self.status_code = 200
        self.response_headers: dict[str, str] = {}
        self.response_body: bytes | None = None
        self.monotonic_time = 100.0
        self.wall_time = time.time()
        self.transport = httpx.MockTransport(self._respond)

    @staticmethod
    def _public_jwk(key: Any, key_id: str, algorithm: str) -> dict[str, Any]:
        if algorithm == "RS256":
            encoded = jwt.algorithms.RSAAlgorithm.to_jwk(key)
        else:
            encoded = jwt.algorithms.ECAlgorithm.to_jwk(key)
        jwk = json.loads(encoded)
        jwk.update({"kid": key_id, "use": "sig", "alg": algorithm})
        return jwk

    def _respond(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.response_body is not None:
            return httpx.Response(
                self.status_code,
                headers=self.response_headers,
                content=self.response_body,
            )
        return httpx.Response(
            self.status_code,
            headers=self.response_headers,
            json={"keys": self.keys},
        )

    def settings(self, **overrides: Any) -> Settings:
        values: dict[str, Any] = {
            "environment": "test",
            "oidc_issuer": "https://issuer.example.test/tenant",
            "oidc_audience": "qubrix-api",
            "jwks_url": "http://localhost:8765/keys",
            "jwks_cache_lifetime_seconds": 30,
            "clock_skew_leeway_seconds": 2,
            "allowed_algorithms": ["RS256", "ES256"],
        }
        values.update(overrides)
        return Settings.model_validate(values)

    def token(
        self,
        *,
        claims: dict[str, Any] | None = None,
        key_id: str = "rsa-1",
        algorithm: str = "RS256",
        headers: dict[str, Any] | None = None,
        signing_key: Any | None = None,
        remove_claims: set[str] | None = None,
    ) -> str:
        now = int(self.wall_time)
        payload: dict[str, Any] = {
            "iss": "https://issuer.example.test/tenant",
            "aud": "qubrix-api",
            "sub": "tenant-user-17",
            "organization_id": "6a79d6d8-23d3-4c14-bca7-6621be7d1701",
            "roles": ["SERVICE"],
            "scope": "whoami:read",
            "iat": now - 1,
            "nbf": now - 1,
            "exp": now + 300,
        }
        if claims is not None:
            payload.update(claims)
        for name in remove_claims or set():
            payload.pop(name, None)
        private_key = signing_key
        if private_key is None:
            private_key = self.ec_private if algorithm == "ES256" else self.rsa_private
        token_headers: dict[str, Any] = {"kid": key_id, "typ": "JWT"}
        if headers:
            token_headers.update(headers)
        return jwt.encode(payload, private_key, algorithm=algorithm, headers=token_headers)


@pytest.fixture
def identity_provider() -> TestIdentityProvider:
    return TestIdentityProvider()


@pytest_asyncio.fixture
async def token_validator(
    identity_provider: TestIdentityProvider,
) -> AsyncGenerator[TokenValidator, None]:
    async with httpx.AsyncClient(
        transport=identity_provider.transport,
        follow_redirects=False,
        timeout=httpx.Timeout(1.0),
    ) as client:
        yield TokenValidator(
            identity_provider.settings(),
            client,
            clock=lambda: identity_provider.wall_time,
            monotonic_clock=lambda: identity_provider.monotonic_time,
        )
