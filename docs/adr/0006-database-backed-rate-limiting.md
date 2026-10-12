# ADR-0006: PostgreSQL-backed rate limiting

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Multiple application replicas need consistent tenant-aware limits without a broker or an additional cache service.

## Decision

Use coarse connection/request/body limits at the ingress before authentication to absorb anonymous traffic without a database call. Invoke atomic PostgreSQL-backed rate budgets only after trusted identity is established; key budgets by organization, authenticated principal, and route class. Quotas and window sizes are configuration, not hard-coded API promises. Return 429 with `Retry-After` when a budget is exceeded. Fail closed for protected write operations if the authenticated limiter cannot enforce a budget; return explicit service unavailability rather than allowing unmetered writes. Bound and clean up idempotency and nonce state so distinct keys/nonces cannot grow without limit. Separately, pagination cursors are HMAC-SHA-256 signed over tenant, query filters, ordering, position, and key version with a server-held secret accessed through a vetted library; cursor authentication failure is a 400, never an unsigned fallback.

## Consequences

- Rate checks add database load and must have bounded indexes, retention/cleanup, and atomic concurrency tests.
- Pre-authentication protection is an ingress responsibility; the database-backed tenant limiter is never consulted before trusted identity exists.
- Cursor signing keys are not database values and require rotation/version handling.
- Reads and writes are tenant/principal isolated; no client-supplied tenant key is trusted.
- No Redis or broker is required in v1. Revisit the storage choice only with measured capacity evidence and a new ADR.
