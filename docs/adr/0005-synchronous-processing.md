# ADR-0005: Synchronous event processing

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

V1 is a modular monolith, with no broker and no background processing requirement. A caller needs a durable result for an ingested security event.

## Decision

Validate, perform applicable verification, calculate risk, persist findings, and return the result synchronously in the request lifecycle. Persist event, verification result, risk assessment, findings, idempotency response, and replay marker within a coordinated database transaction. Provider calls are external and cannot be transactionally rolled back; represent their result or failure explicitly. Do not return success until required durable records commit. Do not add a broker or worker in v1.

## Consequences

- Bound request, provider, and database timeouts and payload sizes.
- Use idempotency to make client retries safe, and separately detect replayed signed events.
- Database/provider outages are visible errors; the service never fabricates a success response.
- Throughput is bounded by synchronous provider/database latency; revisit only with measured requirements and a new ADR.
