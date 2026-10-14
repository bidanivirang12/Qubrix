from __future__ import annotations

import json
import time
from typing import Any

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.jwt_auth import InvalidToken, JwksUnavailable, TokenValidator


@pytest.mark.asyncio
@pytest.mark.parametrize(("algorithm", "key_id"), [("RS256", "rsa-1"), ("ES256", "ec-1")])
async def test_configured_asymmetric_algorithms_validate(
    identity_provider: Any,
    token_validator: TokenValidator,
    algorithm: str,
    key_id: str,
) -> None:
    principal = await token_validator.validate(
        identity_provider.token(algorithm=algorithm, key_id=key_id)
    )
    assert principal.subject == "tenant-user-17"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("claims", "reason"),
    [
        ({"exp": int(time.time()) - 30}, "ExpiredSignatureError"),
        ({"nbf": int(time.time()) + 300}, "ImmatureSignatureError"),
        ({"iss": "https://wrong.example.test"}, "InvalidIssuerError"),
        ({"aud": "wrong-api"}, "InvalidAudienceError"),
    ],
)
async def test_temporal_issuer_and_audience_claims_are_validated(
    identity_provider: Any,
    token_validator: TokenValidator,
    claims: dict[str, Any],
    reason: str,
) -> None:
    with pytest.raises(InvalidToken, match=reason):
        await token_validator.validate(identity_provider.token(claims=claims))


@pytest.mark.asyncio
async def test_none_algorithm_is_rejected(
    identity_provider: Any, token_validator: TokenValidator
) -> None:
    with pytest.raises(InvalidToken, match="disallowed_algorithm"):
        await token_validator.validate(
            identity_provider.token(algorithm="none", signing_key="", key_id="rsa-1")
        )


@pytest.mark.asyncio
@pytest.mark.parametrize("token", ["", "not-a-jwt"])
async def test_empty_or_malformed_token_is_rejected(
    token_validator: TokenValidator,
    token: str,
) -> None:
    with pytest.raises(InvalidToken):
        await token_validator.validate(token)


@pytest.mark.asyncio
async def test_hs256_signed_with_public_key_material_is_rejected(
    identity_provider: Any, token_validator: TokenValidator
) -> None:
    public_key_material = json.dumps(identity_provider.rsa_key, sort_keys=True)
    with pytest.raises(InvalidToken, match="disallowed_algorithm"):
        await token_validator.validate(
            identity_provider.token(
                algorithm="HS256",
                signing_key=public_key_material,
                key_id="rsa-1",
            )
        )


@pytest.mark.asyncio
async def test_algorithm_not_in_configured_allowlist_is_rejected(
    identity_provider: Any,
) -> None:
    import httpx

    async with httpx.AsyncClient(transport=identity_provider.transport) as client:
        validator = TokenValidator(
            identity_provider.settings(allowed_algorithms=["RS256"]),
            client,
            clock=lambda: identity_provider.monotonic_time,
        )
        with pytest.raises(InvalidToken, match="disallowed_algorithm"):
            await validator.validate(identity_provider.token(algorithm="ES256", key_id="ec-1"))


@pytest.mark.asyncio
async def test_tampered_payload_fails_signature_verification(
    identity_provider: Any, token_validator: TokenValidator
) -> None:
    token = identity_provider.token()
    header, payload, signature = token.split(".")
    altered_payload = jwt.utils.base64url_encode(
        json.dumps(
            {
                "iss": identity_provider.settings().oidc_issuer,
                "aud": identity_provider.settings().oidc_audience,
                "sub": "tampered-subject",
                "organization_id": "6a79d6d8-23d3-4c14-bca7-6621be7d1701",
                "roles": ["ADMIN"],
                "scope": "whoami:read",
                "iat": int(time.time()) - 1,
                "nbf": int(time.time()) - 1,
                "exp": int(time.time()) + 300,
            },
            separators=(",", ":"),
        ).encode()
    ).decode()
    assert payload != altered_payload
    with pytest.raises(InvalidToken, match="InvalidSignatureError"):
        await token_validator.validate(f"{header}.{altered_payload}.{signature}")


@pytest.mark.asyncio
async def test_unknown_kid_after_successful_refresh_is_rejected(
    identity_provider: Any, token_validator: TokenValidator
) -> None:
    token = identity_provider.token(key_id="not-published")
    with pytest.raises(InvalidToken, match="unknown_signing_key"):
        await token_validator.validate(token)
    assert len(identity_provider.requests) == 1


@pytest.mark.asyncio
async def test_unknown_kid_can_succeed_after_bounded_refresh(
    identity_provider: Any, token_validator: TokenValidator
) -> None:
    await token_validator.validate(identity_provider.token())
    new_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    new_public_jwk = identity_provider._public_jwk(new_private_key.public_key(), "rsa-2", "RS256")
    identity_provider.keys.append(new_public_jwk)
    identity_provider.monotonic_time += 5.0
    token = identity_provider.token(
        key_id="rsa-2",
        signing_key=new_private_key,
    )
    principal = await token_validator.validate(token)
    assert principal.subject == "tenant-user-17"
    assert len(identity_provider.requests) == 2


@pytest.mark.asyncio
async def test_unknown_kid_refresh_is_limited_by_minimum_interval(
    identity_provider: Any, token_validator: TokenValidator
) -> None:
    await token_validator.validate(identity_provider.token())
    new_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    identity_provider.keys.append(
        identity_provider._public_jwk(new_private_key.public_key(), "rsa-2", "RS256")
    )
    token = identity_provider.token(key_id="rsa-2", signing_key=new_private_key)
    with pytest.raises(InvalidToken, match="unknown_signing_key"):
        await token_validator.validate(token)
    assert len(identity_provider.requests) == 1
    identity_provider.monotonic_time += 5.0
    assert (await token_validator.validate(token)).subject == "tenant-user-17"
    assert len(identity_provider.requests) == 2


@pytest.mark.asyncio
async def test_unreachable_jwks_without_cache_fails_closed(
    identity_provider: Any,
) -> None:
    identity_provider.status_code = 503
    async with httpx.AsyncClient(transport=identity_provider.transport) as client:
        validator = TokenValidator(
            identity_provider.settings(),
            client,
            clock=lambda: identity_provider.monotonic_time,
        )
        with pytest.raises(JwksUnavailable):
            await validator.validate(identity_provider.token())


@pytest.mark.asyncio
async def test_jwks_redirect_is_not_followed(identity_provider: Any) -> None:
    identity_provider.status_code = 302
    identity_provider.response_headers = {"Location": "http://attacker.invalid/keys"}
    async with httpx.AsyncClient(transport=identity_provider.transport) as client:
        validator = TokenValidator(
            identity_provider.settings(),
            client,
            clock=lambda: identity_provider.monotonic_time,
        )
        with pytest.raises(JwksUnavailable):
            await validator.validate(identity_provider.token())
    assert [str(request.url) for request in identity_provider.requests] == [
        "http://localhost:8765/keys"
    ]


@pytest.mark.asyncio
async def test_oversized_jwks_response_is_rejected(identity_provider: Any) -> None:
    identity_provider.response_body = b" " * 262_145
    async with httpx.AsyncClient(transport=identity_provider.transport) as client:
        validator = TokenValidator(
            identity_provider.settings(),
            client,
            clock=lambda: identity_provider.monotonic_time,
        )
        with pytest.raises(JwksUnavailable):
            await validator.validate(identity_provider.token())


@pytest.mark.asyncio
async def test_fresh_cached_key_is_used_when_jwks_becomes_unreachable(
    identity_provider: Any, token_validator: TokenValidator
) -> None:
    token = identity_provider.token()
    await token_validator.validate(token)
    identity_provider.status_code = 503
    principal = await token_validator.validate(token)
    assert principal.subject == "tenant-user-17"
    assert len(identity_provider.requests) == 1


@pytest.mark.asyncio
async def test_expired_cache_and_unreachable_jwks_fail_closed(
    identity_provider: Any, token_validator: TokenValidator
) -> None:
    token = identity_provider.token()
    await token_validator.validate(token)
    identity_provider.monotonic_time += 31.0
    identity_provider.status_code = 503
    with pytest.raises(JwksUnavailable):
        await token_validator.validate(token)


@pytest.mark.asyncio
async def test_jku_x5u_and_embedded_jwk_are_ignored(
    identity_provider: Any, token_validator: TokenValidator
) -> None:
    attacker_jwk = identity_provider._public_jwk(
        rsa.generate_private_key(public_exponent=65537, key_size=2048).public_key(),
        "attacker",
        "RS256",
    )
    token = identity_provider.token(
        headers={
            "jku": "http://attacker.invalid/jwks",
            "x5u": "http://attacker.invalid/certificate",
            "jwk": attacker_jwk,
        }
    )
    await token_validator.validate(token)
    assert [str(request.url) for request in identity_provider.requests] == [
        "http://localhost:8765/keys"
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "claim",
    ["sub", "organization_id", "roles", "scope"],
)
async def test_required_identity_claims_must_exist(
    identity_provider: Any, token_validator: TokenValidator, claim: str
) -> None:
    token = identity_provider.token(remove_claims={claim})
    with pytest.raises(InvalidToken):
        await token_validator.validate(token)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("claim", "value"),
    [
        ("sub", 10),
        ("organization_id", 10),
        ("roles", "SERVICE"),
        ("roles", ["SERVICE", 10]),
        ("scope", ["whoami:read"]),
        ("aud", ["qubrix-api"]),
        ("iat", "today"),
    ],
)
async def test_claim_types_are_strict(
    identity_provider: Any,
    token_validator: TokenValidator,
    claim: str,
    value: Any,
) -> None:
    with pytest.raises(InvalidToken):
        await token_validator.validate(identity_provider.token(claims={claim: value}))


@pytest.mark.asyncio
async def test_organization_claim_must_be_uuid(
    identity_provider: Any, token_validator: TokenValidator
) -> None:
    with pytest.raises(InvalidToken, match="invalid_organization_uuid"):
        await token_validator.validate(
            identity_provider.token(claims={"organization_id": "not-a-uuid"})
        )


@pytest.mark.asyncio
async def test_unknown_role_is_rejected(
    identity_provider: Any, token_validator: TokenValidator
) -> None:
    with pytest.raises(InvalidToken, match="unknown_role"):
        await token_validator.validate(identity_provider.token(claims={"roles": ["ROOT"]}))


@pytest.mark.asyncio
async def test_extra_large_token_is_rejected_before_jwks_fetch(
    identity_provider: Any, token_validator: TokenValidator
) -> None:
    with pytest.raises(InvalidToken, match="token_too_large"):
        await token_validator.validate("x" * 16_385)
    assert not identity_provider.requests


@pytest.mark.asyncio
async def test_extra_large_claim_set_is_rejected(
    identity_provider: Any, token_validator: TokenValidator
) -> None:
    extras = {f"extension_{index}": index for index in range(24)}
    with pytest.raises(InvalidToken, match="claim_set_too_large"):
        await token_validator.validate(identity_provider.token(claims=extras))


@pytest.mark.asyncio
async def test_unexpected_nested_claim_type_is_rejected(
    identity_provider: Any, token_validator: TokenValidator
) -> None:
    with pytest.raises(InvalidToken, match="unexpected_claim_type"):
        await token_validator.validate(
            identity_provider.token(claims={"custom_claim": {"admin": True}})
        )
