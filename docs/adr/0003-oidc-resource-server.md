# ADR-0003: OIDC JWT resource server

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Qubrix is multi-tenant and must not maintain local passwords or let clients assert tenant/actor/role identity.

## Decision

Accept bearer JWTs issued by configured OIDC issuers. Validate JWT signature via issuer JWKS, issuer, audience, temporal claims, and an explicit algorithm allowlist. Derive organization mapping, actor subject, roles, and scopes only from validated claims and trusted server-side issuer/tenant mapping. Unknown key, invalid token, or unavailable verification fails closed. Cache/refetch JWKS under bounded policy without accepting an unverified token during outages. Do not implement local password authentication.

## Consequences

- API routes require explicit role and scope, plus object-level organization checks.
- Request schemas reject identity/authorization fields.
- Tests must cover key rotation, unknown `kid`, issuer/JWKS outage, claim validation, and cross-tenant object access.
- Identity-provider availability is an explicit dependency; authentication cannot silently fail open.
