from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Final

from fastapi import Depends

from app.core.auth_dependencies import get_current_principal
from app.core.identity import Principal

Endpoint = tuple[str, str]


@dataclass(frozen=True, slots=True)
class EndpointPermission:
    roles: frozenset[str]
    scope: str


ENDPOINT_PERMISSIONS: Final[dict[Endpoint, EndpointPermission]] = {
    ("GET", "/api/v1/whoami"): EndpointPermission(
        roles=frozenset({"ADMIN", "SECURITY_ANALYST", "AUDITOR", "SERVICE"}),
        scope="whoami:read",
    ),
}


class AuthorizationDenied(Exception):
    pass


@dataclass(frozen=True, slots=True)
class AuthorizationRequirement:
    endpoint: Endpoint
    permission: EndpointPermission

    async def __call__(
        self,
        principal: Annotated[Principal, Depends(get_current_principal)],
    ) -> None:
        if not self.permission.roles.intersection(principal.roles):
            raise AuthorizationDenied
        if self.permission.scope not in principal.scopes:
            raise AuthorizationDenied


def require(method: str, path: str) -> AuthorizationRequirement:
    endpoint = (method.upper(), path)
    try:
        permission = ENDPOINT_PERMISSIONS[endpoint]
    except KeyError as error:
        raise ValueError(
            f"No explicit authorization policy is registered for {endpoint}"
        ) from error
    return AuthorizationRequirement(endpoint=endpoint, permission=permission)
