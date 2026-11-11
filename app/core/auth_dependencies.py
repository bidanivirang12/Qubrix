from __future__ import annotations

import logging
from typing import Annotated

import httpx
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.identity import Principal
from app.core.jwt_auth import InvalidToken, JwksUnavailable, TokenValidator

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)
bearer_credentials = Depends(bearer_scheme)


class AuthenticationRequired(Exception):
    pass


class IdentityProviderUnavailable(Exception):
    pass


async def get_current_principal(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, bearer_credentials],
) -> Principal:
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        reason = (
            "missing_authorization"
            if "authorization" not in request.headers
            else "malformed_authorization"
        )
        logger.warning("Bearer authentication failed", extra={"auth_reason": reason})
        raise AuthenticationRequired
    validator: TokenValidator = request.app.state.token_validator
    try:
        return await validator.validate(credentials.credentials)
    except JwksUnavailable as error:
        raise IdentityProviderUnavailable from error
    except InvalidToken as error:
        raise AuthenticationRequired from error


def create_auth_http_client(
    transport: httpx.AsyncBaseTransport | None = None,
) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=transport,
        follow_redirects=False,
        timeout=httpx.Timeout(3.0),
        limits=httpx.Limits(max_connections=5, max_keepalive_connections=5),
    )
