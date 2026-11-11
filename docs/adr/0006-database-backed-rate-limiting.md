# ADR-0006: PostgreSQL-backed rate limiting

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Multiple application replicas need consistent tenant-aware limits without a broker or an additional cache service.

## Decision

Use two rate-limit layers. Before authentication, apply a bounded, expiring, per-process token bucket keyed by the client address; it never accesses PostgreSQL. This is only an application-level guard: ingress or the gateway remains the volumetric defense. After authentication, invoke an atomic PostgreSQL fixed-window counter keyed by organization, subject, and the route class declared in the endpoint policy. Quotas and the window size are bounded configuration, not hard-coded API promises. Return 429 problem+json with `Retry-After` when a budget is exceeded. Fail closed with 503 when the authenticated limiter cannot enforce a budget. Clean expired windows using the configured retention period. Separately, pagination cursors are HMAC-SHA-256 signed over tenant, query filters, ordering, position, and key version with a server-held secret accessed through a vetted library; cursor authentication failure is a 400, never an unsigned fallback.

## Consequences

- Rate checks add database load and must have bounded indexes, retention/cleanup, and atomic concurrency tests.
- The pre-authentication token bucket is per process and is not a substitute for ingress/gateway volumetric controls.
- The authenticated rate limiter is never consulted before trusted identity exists and always uses route classes from endpoint policy, never request input.
- Cursor signing keys are not database values and require rotation/version handling.
- Reads and writes are tenant/principal isolated; no client-supplied tenant key is trusted.
- No Redis or broker is required in v1. Revisit the storage choice only with measured capacity evidence and a new ADR.
