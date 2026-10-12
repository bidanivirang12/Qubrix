# ADR-0003: OIDC JWT resource server

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Qubrix is multi-tenant and must not maintain local passwords or let clients assert tenant/actor/role identity.

## Decision

Accept bearer JWTs issued by the configured OIDC issuer. Validate JWT signature via issuer JWKS, issuer, audience, temporal claims, and an explicit algorithm allowlist. Derive identity only from validated claims: `sub` is actor subject; `organization_id` is the external organization claim mapped through trusted tenant provisioning; `roles` is an array containing `ADMIN`, `SECURITY_ANALYST`, `AUDITOR`, and/or `SERVICE`; `scope` is the OAuth space-delimited scope string. Do not accept tenant, actor, role, or scope identity from request bodies. Tenant and role administration lives in the IdP/provisioning plane, not the Qubrix API.

Unknown key, invalid token, or unavailable JWKS fails authentication closed. Cache/refetch JWKS under bounded policy without accepting an unverified token during outages. Return `WWW-Authenticate: Bearer` on every 401. Do not implement local password authentication.

## Consequences

- API routes require explicit role and scope, plus object-level organization checks.
- Request schemas reject identity/authorization fields.
- Decrypt is not granted to any human role by default; a workload requires explicit `SERVICE` role and `crypto:decrypt` scope.
- Tests must cover key rotation, unknown `kid`, issuer/JWKS outage, claim validation, and cross-tenant object access.
- Identity-provider availability is an explicit dependency; authentication cannot silently fail open.
