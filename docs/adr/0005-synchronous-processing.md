# ADR-0005: Synchronous event processing

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

V1 is a modular monolith, with no broker and no background processing requirement. A caller needs a durable result for an ingested security event.

## Decision

Validate bounded typed event attributes, perform applicable canonical-message verification, calculate risk, persist findings, and return the result synchronously in the request lifecycle. Persist event, verification result, risk assessment and version fields, findings, idempotency response, and replay marker within a coordinated database transaction. Provider calls are external and cannot be transactionally rolled back; represent their result or failure explicitly. Do not return success until required durable records commit. Do not add a broker or worker in v1.

## Consequences

- Bound request, provider, and database timeouts and payload sizes.
- Event and signed-message ingestion require `Idempotency-Key`: same key/same completed request returns its original result; same key/different request returns 409 `idempotency_conflict`; same key while in flight returns 409 `idempotency_in_progress`; missing key returns 400 `idempotency_key_required`. Fingerprints exclude trace-only `correlation_id`. Reusing an organization-scoped `event_id` with another key returns 409 `event_id_conflict` and records a replay finding plus a `FLAG` attempt assessment. Separately detect reused signed nonces; signatures require a nonce.
- All request validation errors use RFC 9457 with HTTP 400, including out-of-window event timestamps, missing nonce, invalid cursor, and limit over max.
- Database/provider outages are visible errors; the service never fabricates a success response.
- Throughput is bounded by synchronous provider/database latency; revisit only with measured requirements and a new ADR.
