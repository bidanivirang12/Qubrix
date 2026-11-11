from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Final

from fastapi import Depends, Request
from fastapi.routing import APIRoute
from sqlalchemy.exc import SQLAlchemyError

from app.core.auth_dependencies import (
    IdentityProviderUnavailable,
    get_current_principal,
)
from app.core.audit_writer import record_auth_denial
from app.core.identity import Principal
from app.core.post_auth_limiter import (
    RateLimitExceeded,
    consume_post_auth_budget,
    quota_for_route,
)

Endpoint = tuple[str, str]


@dataclass(frozen=True, slots=True)
class EndpointPermission:
    roles: frozenset[str]
    scope: str
    route_class: str = "human_reads"


ENDPOINT_PERMISSIONS: Final[dict[Endpoint, EndpointPermission]] = {
    ("GET", "/api/v1/whoami"): EndpointPermission(
        roles=frozenset({"ADMIN", "SECURITY_ANALYST", "AUDITOR", "SERVICE"}),
        scope="whoami:read",
        route_class="human_reads",
    ),
}


class AuthorizationDenied(Exception):
    pass


def route_class_for_request(request: Request) -> str:
    route = request.scope.get("route")
    if not isinstance(route, APIRoute):
        raise RuntimeError("Authenticated request has no registered API route")
    endpoint = (request.method.upper(), route.path)
    try:
        return ENDPOINT_PERMISSIONS[endpoint].route_class
    except KeyError as error:
        raise RuntimeError(f"No route class is registered for {endpoint}") from error


@dataclass(frozen=True, slots=True)
class AuthorizationRequirement:
    endpoint: Endpoint
    permission: EndpointPermission

    async def __call__(
        self,
        request: Request,
        principal: Annotated[Principal, Depends(get_current_principal)],
    ) -> None:
        address = request.client.host if request.client is not None else None
        if not self.permission.roles.intersection(principal.roles):
            await record_auth_denial(
                request.app.state.engine,
                request.app.state.settings,
                principal,
                action="auth.authorization_denied",
                endpoint_route_class=self.permission.route_class,
                telemetry=request.app.state.security_telemetry,
                address=address,
            )
            raise AuthorizationDenied
        if self.permission.scope not in principal.scopes:
            await record_auth_denial(
                request.app.state.engine,
                request.app.state.settings,
                principal,
                action="auth.authorization_denied",
                endpoint_route_class=self.permission.route_class,
                telemetry=request.app.state.security_telemetry,
                address=address,
            )
            raise AuthorizationDenied
        try:
            retry_after = await consume_post_auth_budget(
                request.app.state.engine,
                request.app.state.settings,
                principal,
                self.permission.route_class,
                quota_for_route(request.app.state.settings, self.permission.route_class),
            )
        except SQLAlchemyError as error:
            raise IdentityProviderUnavailable from error
        if retry_after is not None:
            raise RateLimitExceeded(retry_after)


def require(method: str, path: str) -> AuthorizationRequirement:
    endpoint = (method.upper(), path)
    try:
        permission = ENDPOINT_PERMISSIONS[endpoint]
    except KeyError as error:
        raise ValueError(f"No explicit authorization policy is registered for {endpoint}") from error
    return AuthorizationRequirement(endpoint=endpoint, permission=permission)
