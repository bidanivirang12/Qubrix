from __future__ import annotations

import math
from typing import Annotated

import httpx
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import SQLAlchemyError

from app.core.identity import Principal
from app.core.identity_checks import (
    IdentityStoreUnavailable,
    OrganizationInactive,
    SubjectRevoked,
    UnprovisionedOrganization,
)
from app.core.jwt_auth import InvalidToken, JwksUnavailable, TokenValidator
from app.core.post_auth_limiter import RateLimitExceeded
from app.core.security_telemetry import SecurityTelemetry

bearer_scheme = HTTPBearer(auto_error=False)
bearer_credentials = Depends(bearer_scheme)


class AuthenticationRequired(Exception):
    pass


class IdentityProviderUnavailable(Exception):
    pass


class OrganizationNotProvisioned(Exception):
    pass


def _client_address(request: Request) -> str | None:
    return request.client.host if request.client is not None else None


async def get_current_principal(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, bearer_credentials],
) -> Principal:
    address = _client_address(request)
    telemetry: SecurityTelemetry = request.app.state.security_telemetry
    retry_after = request.app.state.pre_auth_limiter.consume(address or "unknown")
    if retry_after is not None:
        telemetry.record("pre_auth_rate_limited", address)
        raise RateLimitExceeded(math.ceil(retry_after))

    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        reason = (
            "missing_authorization"
            if "authorization" not in request.headers
            else "malformed_authorization"
        )
        telemetry.record(reason, address)
        raise AuthenticationRequired
    validator: TokenValidator = request.app.state.token_validator
    try:
        principal = await validator.validate(credentials.credentials)
    except JwksUnavailable as error:
        telemetry.record("jwks_unavailable", address)
        raise IdentityProviderUnavailable from error
    except InvalidToken as error:
        telemetry.record("invalid_token", address)
        raise AuthenticationRequired from error

    try:
        await request.app.state.identity_checks.verify(request.app.state.engine, principal)
    except UnprovisionedOrganization as error:
        telemetry.record("unprovisioned_organization", address)
        raise OrganizationNotProvisioned from error
    except (SubjectRevoked, OrganizationInactive) as error:
        from app.core.authorization import AuthorizationDenied
        from app.core.audit_writer import record_auth_denial
        from app.core.authorization import route_class_for_request

        await record_auth_denial(
            request.app.state.engine,
            request.app.state.settings,
            principal,
            action=f"auth.{error.reason}",
            endpoint_route_class=route_class_for_request(request),
            telemetry=telemetry,
            address=address,
        )
        raise AuthorizationDenied from error
    except (IdentityStoreUnavailable, SQLAlchemyError) as error:
        telemetry.record("security_dependency_failure", address)
        raise IdentityProviderUnavailable from error
    return principal


def create_auth_http_client(
    transport: httpx.AsyncBaseTransport | None = None,
) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=transport,
        follow_redirects=False,
        timeout=httpx.Timeout(3.0),
        limits=httpx.Limits(max_connections=5, max_keepalive_connections=5),
    )
