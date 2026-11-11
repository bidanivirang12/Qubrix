# ADR-0012: JWT library and JWKS validation

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

Phase 3A requires an OIDC resource-server implementation with strict JWT
algorithm, issuer, audience, temporal-claim, identity-claim, and JWKS-fetch
validation. JWT serialization and signature verification must use maintained
libraries rather than application-authored parsing or cryptographic primitives.

## Decision

Use **PyJWT[crypto] 2.15.1**, resolved and pinned by `uv.lock`, for compact JWT
header/claim processing and signature verification. Its cryptography extra
provides the maintained asymmetric key backend. Use HTTPX async clients for
JWKS retrieval.

The verifier selects keys only by `kid` from the configured `QUBRIX_JWKS_URL`.
It passes an explicit configured algorithm list to PyJWT and rejects token
algorithms outside it before key lookup. It does not use token `jku`, `x5u`, or
embedded `jwk` members. JWKS redirects are disabled; response bytes and key
count are bounded; refreshes for unknown key IDs are rate-limited. Cache
lifetime, stale-key grace, clock leeway, and token lifetime use bounded settings.
The JWKS cache defaults to a 300-second lifetime followed by a 300-second
stale-key grace period. During grace, an already-cached matching key remains
usable if refresh fails; after grace ends, validation fails closed with a
dependency-unavailable response. Failed refreshes are recorded separately.
The next refresh may start once the five-second minimum interval from the
failed attempt has elapsed.

The token contract requires the exact configured issuer and an audience claim
equal to the configured audience string or a list of strings containing it.
The required standard claims are `exp`, `nbf`, and `iat`, validated against an
injected UTC clock and bounded leeway. Identity claims `sub`, UUID
`organization_id`, `roles`, and `scope` must have their specified types.
Unknown roles are rejected instead of ignored: a typo or unrecognized IdP role
must not be silently treated as a valid principal. An IdP role rollout or typo
can therefore cause authentication to fail until the role is corrected or
explicitly supported by the application. Tokens whose `exp - iat` exceeds
`QUBRIX_MAX_TOKEN_LIFETIME_SECONDS` (default 3,600 seconds) are rejected.
Bearer tokens are limited to 16 KiB and claim sets to 32 claims. Authentication
failures expose a generic RFC 9457 response; logs contain a safe internal
failure reason but never the token or claim values.

Production requires HTTPS for issuer and JWKS URLs. HTTP JWKS is permitted only
for a localhost test IdP. Test identity-provider keys are generated in tests
and served by HTTPX `MockTransport`; tests perform no network access.

## Consequences

- `PyJWT[crypto]` is a production dependency recorded in `pyproject.toml` and
  `uv.lock`.
- The application has no custom JWT parser, signature implementation, or
  dynamic token-selected key URL.
- Unknown key IDs after a successful bounded refresh are authentication
  failures; inability to obtain an applicable valid key is a 503 dependency
  failure.
- Key rotation and outage behavior must remain covered by unit and API tests.
