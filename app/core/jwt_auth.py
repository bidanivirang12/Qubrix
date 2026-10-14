from __future__ import annotations

import asyncio
import json
import logging
import math
import time
from collections.abc import Callable
from typing import Any
from uuid import UUID

import httpx
import jwt

from app.core.identity import Principal
from app.core.settings import Settings

logger = logging.getLogger(__name__)

MAX_TOKEN_BYTES = 16_384
MAX_CLAIMS = 32
MAX_JWKS_BYTES = 262_144
MAX_JWKS_KEYS = 32
MAX_KID_LENGTH = 256
MIN_REFRESH_INTERVAL_SECONDS = 5.0
KNOWN_ROLES = frozenset({"ADMIN", "SECURITY_ANALYST", "AUDITOR", "SERVICE"})
REQUIRED_CLAIMS = ("iss", "aud", "exp", "nbf", "iat", "sub", "organization_id", "roles", "scope")


class InvalidToken(Exception):
    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


class JwksUnavailable(Exception):
    pass


class UnknownSigningKey(Exception):
    pass


class TokenValidator:
    def __init__(
        self,
        settings: Settings,
        client: httpx.AsyncClient,
        *,
        clock: Callable[[], float] = time.time,
        monotonic_clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._settings = settings
        self._client = client
        self._clock = clock
        self._monotonic_clock = monotonic_clock
        self._keys: dict[str, dict[str, Any]] = {}
        self._expires_at = 0.0
        self._last_refresh_at = float("-inf")
        self._last_refresh_failure_at: float | None = None
        self._refresh_lock = asyncio.Lock()

    async def validate(self, token: str) -> Principal:
        if len(token.encode("utf-8", errors="replace")) > MAX_TOKEN_BYTES:
            raise InvalidToken("token_too_large")
        if not self._settings.oidc_issuer or not self._settings.oidc_audience:
            raise JwksUnavailable("OIDC issuer and audience are not configured")
        if not self._settings.jwks_url:
            raise JwksUnavailable("JWKS URL is not configured")

        try:
            header = jwt.get_unverified_header(token)
            algorithm = header.get("alg")
            key_id = header.get("kid")
            if (
                not isinstance(algorithm, str)
                or algorithm not in self._settings.allowed_algorithms
                or algorithm.startswith("HS")
                or algorithm == "none"
            ):
                raise InvalidToken("disallowed_algorithm")
            if not isinstance(key_id, str) or not key_id or len(key_id) > MAX_KID_LENGTH:
                raise InvalidToken("invalid_key_id")

            jwk = await self._get_jwk(key_id)
            if jwk.get("alg") is not None and jwk["alg"] != algorithm:
                raise InvalidToken("key_algorithm_mismatch")
            if jwk.get("use") not in (None, "sig"):
                raise InvalidToken("key_not_for_signatures")
            key_ops = jwk.get("key_ops")
            if key_ops is not None and (not isinstance(key_ops, list) or "verify" not in key_ops):
                raise InvalidToken("key_not_for_verification")
            if any(name in jwk for name in ("d", "p", "q", "dp", "dq", "qi", "oth", "k")):
                raise InvalidToken("private_or_symmetric_jwks_key")
            try:
                public_key = jwt.PyJWK.from_dict(jwk, algorithm=algorithm).key
            except (jwt.PyJWTError, TypeError, ValueError, AttributeError, OverflowError) as error:
                raise InvalidToken("invalid_jwks_key") from error

            claims = jwt.decode(
                token,
                key=public_key,
                algorithms=[algorithm],
                issuer=self._settings.oidc_issuer,
                options={
                    "require": list(REQUIRED_CLAIMS),
                    "verify_aud": False,
                    "verify_exp": False,
                    "verify_iat": False,
                    "verify_nbf": False,
                },
            )
            return self._principal_from_claims(claims)
        except JwksUnavailable:
            logger.warning(
                "OIDC signing keys unavailable", extra={"auth_reason": "jwks_unavailable"}
            )
            raise
        except UnknownSigningKey as error:
            logger.warning("Bearer token rejected", extra={"auth_reason": "unknown_signing_key"})
            raise InvalidToken("unknown_signing_key") from error
        except InvalidToken as error:
            logger.warning("Bearer token rejected", extra={"auth_reason": error.reason})
            raise
        except jwt.PyJWTError as error:
            reason = type(error).__name__
            logger.warning("Bearer token rejected", extra={"auth_reason": reason})
            raise InvalidToken(reason) from error
        except (TypeError, ValueError, UnicodeError, OverflowError) as error:
            reason = type(error).__name__
            logger.warning("Bearer token rejected", extra={"auth_reason": reason})
            raise InvalidToken(reason) from error

    async def _get_jwk(self, key_id: str) -> dict[str, Any]:
        now = self._monotonic_clock()
        fresh = now < self._expires_at
        if fresh and key_id in self._keys:
            return self._keys[key_id]

        async with self._refresh_lock:
            now = self._monotonic_clock()
            fresh = now < self._expires_at
            if fresh and key_id in self._keys:
                return self._keys[key_id]
            if now - self._last_refresh_at < MIN_REFRESH_INTERVAL_SECONDS:
                if fresh:
                    raise UnknownSigningKey
                if self._has_usable_stale_key(key_id, now):
                    return self._keys[key_id]
                raise JwksUnavailable("JWKS cache expired and refresh is rate-limited")

            self._last_refresh_at = now
            try:
                keys = await self._fetch_jwks()
            except (
                JwksUnavailable,
                httpx.HTTPError,
                json.JSONDecodeError,
                UnicodeError,
                ValueError,
            ) as error:
                self._last_refresh_failure_at = now
                if self._has_usable_stale_key(key_id, now):
                    return self._keys[key_id]
                raise JwksUnavailable("configured JWKS endpoint could not be refreshed") from error

            self._keys = keys
            self._expires_at = now + self._settings.jwks_cache_lifetime_seconds
            self._last_refresh_failure_at = None
            if key_id not in self._keys:
                raise UnknownSigningKey
            return self._keys[key_id]

    def _has_usable_stale_key(self, key_id: str, now: float) -> bool:
        stale_until = self._expires_at + self._settings.jwks_stale_key_grace_seconds
        return key_id in self._keys and now < stale_until

    async def _fetch_jwks(self) -> dict[str, dict[str, Any]]:
        url = self._settings.jwks_url
        if url is None:
            raise JwksUnavailable("JWKS URL is not configured")
        async with self._client.stream("GET", url, follow_redirects=False) as response:
            if response.is_redirect:
                raise JwksUnavailable("JWKS redirects are not accepted")
            response.raise_for_status()
            content = bytearray()
            async for chunk in response.aiter_bytes():
                content.extend(chunk)
                if len(content) > MAX_JWKS_BYTES:
                    raise JwksUnavailable("JWKS response exceeds the configured size bound")

        document: Any = json.loads(content)
        if not isinstance(document, dict) or not isinstance(document.get("keys"), list):
            raise JwksUnavailable("JWKS document has an invalid shape")
        if not document["keys"] or len(document["keys"]) > MAX_JWKS_KEYS:
            raise JwksUnavailable("JWKS key count is outside the accepted bounds")

        result: dict[str, dict[str, Any]] = {}
        for item in document["keys"]:
            if not isinstance(item, dict):
                raise JwksUnavailable("JWKS contains a non-object key")
            key_id = item.get("kid")
            key_type = item.get("kty")
            if (
                not isinstance(key_id, str)
                or not key_id
                or len(key_id) > MAX_KID_LENGTH
                or key_id in result
                or not isinstance(key_type, str)
                or key_type not in {"RSA", "EC", "OKP"}
            ):
                raise JwksUnavailable("JWKS contains an invalid or duplicate signing key")
            result[key_id] = item
        return result

    def _principal_from_claims(self, claims: dict[str, Any]) -> Principal:
        if len(claims) > MAX_CLAIMS:
            raise InvalidToken("claim_set_too_large")
        if claims.get("iss") != self._settings.oidc_issuer:
            raise InvalidToken("issuer_mismatch")
        audience = claims.get("aud")
        if isinstance(audience, str):
            if audience != self._settings.oidc_audience:
                raise InvalidToken("audience_mismatch")
        elif isinstance(audience, list):
            if any(not isinstance(item, str) for item in audience):
                raise InvalidToken("invalid_audience_claim")
            if self._settings.oidc_audience not in audience:
                raise InvalidToken("audience_mismatch")
        else:
            raise InvalidToken("invalid_audience_claim")

        subject = claims.get("sub")
        organization_value = claims.get("organization_id")
        roles_value = claims.get("roles")
        scope_value = claims.get("scope")
        if not isinstance(subject, str) or not subject or len(subject) > 256:
            raise InvalidToken("invalid_subject_claim")
        if not isinstance(organization_value, str):
            raise InvalidToken("invalid_organization_claim")
        if not isinstance(roles_value, list) or len(roles_value) > len(KNOWN_ROLES):
            raise InvalidToken("invalid_roles_claim")
        roles: set[str] = set()
        for role in roles_value:
            if not isinstance(role, str):
                raise InvalidToken("invalid_roles_claim")
            if role not in KNOWN_ROLES:
                raise InvalidToken("unknown_role")
            roles.add(role)
        if not isinstance(scope_value, str) or len(scope_value) > 2_048:
            raise InvalidToken("invalid_scope_claim")
        for claim_name in ("exp", "nbf", "iat"):
            value = claims.get(claim_name)
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(value)
            ):
                raise InvalidToken(f"invalid_{claim_name}_claim")
        issued_at = float(claims["iat"])
        expires_at = float(claims["exp"])
        not_before = float(claims["nbf"])
        now = self._clock()
        leeway = self._settings.clock_skew_leeway_seconds
        if expires_at <= issued_at or not_before >= expires_at:
            raise InvalidToken("invalid_temporal_claim_relationship")
        if issued_at > now + leeway:
            raise InvalidToken("issued_at_in_future")
        if expires_at <= now - leeway:
            raise InvalidToken("token_expired")
        if not_before > now + leeway:
            raise InvalidToken("token_not_yet_valid")
        if expires_at - issued_at > self._settings.max_token_lifetime_seconds:
            raise InvalidToken("token_lifetime_exceeded")
        try:
            organization_id = UUID(organization_value)
        except ValueError as error:
            raise InvalidToken("invalid_organization_uuid") from error

        for name, value in claims.items():
            if name not in REQUIRED_CLAIMS and not isinstance(
                value, (str, int, float, bool, type(None))
            ):
                raise InvalidToken("unexpected_claim_type")
        return Principal(
            subject=subject,
            organization_id=organization_id,
            roles=frozenset(roles),
            scopes=frozenset(scope_value.split()),
        )
