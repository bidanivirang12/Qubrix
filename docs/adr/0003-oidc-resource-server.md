# ADR-0003: OIDC JWT resource server

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Qubrix is multi-tenant and must not maintain local passwords or let clients assert tenant/actor/role identity.

## Decision

Accept bearer JWTs issued by the configured OIDC issuer. Validate signature via only the configured JWKS URL, exact issuer and audience, required temporal claims, and the explicit `QUBRIX_ALLOWED_ALGORITHMS` allowlist. `RS256` and `ES256` are the default algorithms. Reject `none`, all HMAC algorithms, and any unconfigured algorithm. Derive identity only from validated claims: `sub` is actor subject; `organization_id` is a UUID external organization claim mapped through trusted tenant provisioning; `roles` is an array containing only `ADMIN`, `SECURITY_ANALYST`, `AUDITOR`, and/or `SERVICE`; `scope` is the OAuth space-delimited scope string. Unknown roles and unexpected claim types are rejected. Do not accept tenant, actor, role, or scope identity from request bodies or non-Authorization headers. Tenant and role administration lives in the IdP/provisioning plane, not the Qubrix API.

JWKS retrieval is asynchronous, uses the fixed `QUBRIX_JWKS_URL`, does not follow redirects, and has bounded response size, key count, cache lifetime, and unknown-key refresh frequency. `jku`, `x5u`, and embedded `jwk` token headers are ignored. Production requires HTTPS for both issuer and JWKS URLs; HTTP is permitted only for localhost test identity providers. Tokens and claims have explicit size/count/type bounds. Authentication failures are generic RFC 9457 responses; internal logs record a safe reason category, never token or claim values. Library choice and exact lockfile version are recorded in [ADR-0012](./0012-jwt-library-and-jwks-validation.md).

Unknown key, invalid token, or unavailable JWKS fails authentication closed. Cache/refetch JWKS under bounded policy without accepting an unverified token during outages. Return `WWW-Authenticate: Bearer` on every 401. Do not implement local password authentication.

## Consequences

- API routes require explicit role and scope, plus object-level organization checks.
- Request schemas reject identity/authorization fields.
- Decrypt is not granted to any human role by default; a workload requires explicit `SERVICE` role and `crypto:decrypt` scope.
- Tests must cover key rotation, unknown `kid`, issuer/JWKS outage, claim validation, and cross-tenant object access.
- Identity-provider availability is an explicit dependency; authentication cannot silently fail open.
