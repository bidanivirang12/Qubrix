# API contracts

## Common contract

- All application endpoints are under `/api/v1`. The API is a bearer-token OIDC resource server; no local-password endpoints exist.
- Authenticate JWTs against configured issuer/JWKS and validate signature, issuer, audience, expiry, and accepted algorithm. Each route requires both the listed role and OAuth scope. Organization, actor, roles, and scopes come only from verified identity claims; request bodies cannot set them.
- JSON uses UTF-8 and timestamps use RFC 3339 UTC. IDs are opaque UUIDs. Unknown request properties are rejected. Requests never contain full card numbers or plaintext sensitive payloads.
- Lists use `limit` (default 50, max 200) and opaque `cursor`. Responses contain `items` and `next_cursor` (null at end). Cursors bind to the authenticated organization and query ordering; clients cannot use them to cross tenants.
- Mutating event ingestion requires `Idempotency-Key` (1-128 visible ASCII characters). Scope is organization + authenticated actor + operation. Canonical request fingerprint covers the validated client-supplied request, not server-assigned fields. Same key and same request returns the original committed result; same key and different request returns 409 `idempotency_conflict`. A database uniqueness constraint resolves races. A new idempotency key does not bypass signed-event replay detection.
- Rate-limited responses use 429 and `Retry-After` in seconds. Budgets are keyed by organization, principal, and route class; exact configured quotas are deployment configuration, not API constants.

## Common schemas

### Event ingestion request

```json
{
  "event_id": "uuid",
  "event_type": "TRANSACTION_ATTEMPT",
  "occurred_at": "2026-10-12T05:00:00Z",
  "subject_ref": "opaque-tokenized-reference",
  "payload_digest": "base64url-digest",
  "nonce": "opaque-event-nonce",
  "signature": {
    "key_id": "tenant-key-reference",
    "algorithm": "explicit-allowlisted-algorithm-id",
    "value": "base64-signature"
  }
}
```

`event_type` is exactly one of `TRANSACTION_ATTEMPT`, `LOGIN_ATTEMPT`, `SIGNED_MESSAGE_RECEIVED`, or `KEY_LIFECYCLE_CHANGE`. `event_id`, `event_type`, and `occurred_at` are required. `subject_ref`, `payload_digest`, `nonce`, and `signature` are optional when inapplicable to that event type; event-type-specific validation applies. A signature envelope must include all three fields. The schema deliberately has no `organization_id`, `actor_id`, `received_at`, `verification_status`, `risk_score`, `decision`, or `finding` input. The server assigns `organization_id` and `received_at`.

`subject_ref` is an opaque/tokenized reference, never a PAN. `payload_digest` is a digest of an externally held or otherwise approved payload representation; it is not a license to submit plaintext sensitive content. No sensitive payload body is accepted by this contract.

### Event ingestion response (`201 Created`)

```json
{
  "event": {
    "id": "uuid",
    "event_id": "uuid",
    "event_type": "TRANSACTION_ATTEMPT",
    "organization_id": "uuid",
    "actor_subject": "issuer-subject",
    "occurred_at": "2026-10-12T05:00:00Z",
    "received_at": "2026-10-12T05:00:01Z"
  },
  "verification": {
    "status": "VALID",
    "key_id": "tenant-key-reference"
  },
  "risk": {
    "score": 32,
    "decision": "APPROVE",
    "model_version": "versioned-rule-set"
  },
  "findings": []
}
```

Verification status is one of `VALID`, `INVALID`, `UNKNOWN_KEY`, `UNAVAILABLE`, or `NOT_APPLICABLE`. Decision is `APPROVE`, `VERIFY`, or `FLAG`. Scores are integers 0-100. A failed/unavailable verification response includes its independently persisted finding reference. Sensitive signature bytes and key material are not returned. A repeated identical idempotent request returns the original status/body with an `Idempotency-Replayed: true` response header.

The base risk score maps to `APPROVE` for 0-39, `VERIFY` for 40-69, and `FLAG` for 70-100. `risk.score` is the base score and `risk.decision` is the final decision after hard overrides: `INVALID` or `UNKNOWN_KEY` forces at least `VERIFY`, and replay forces `FLAG`. `UNAVAILABLE` verification creates its own finding and is never treated as valid. A valid signature never lowers the score.

### RFC 9457 problem details

Errors use `application/problem+json`: standard `type`, `title`, `status`, `detail`, and `instance`, plus stable extension `code` and optional `request_id`. `detail` must not include credentials, signature material, key bytes, or sensitive payloads.

| HTTP | `code` | Meaning |
|---:|---|---|
| 400 | `invalid_request` | Malformed JSON, invalid schema, or invalid pagination cursor |
| 401 | `unauthenticated` | Missing or invalid token; the request has no trusted identity |
| 403 | `forbidden` | Authenticated identity lacks required role/scope |
| 404 | `not_found` | Resource absent or not visible within caller's organization |
| 409 | `idempotency_conflict` | Same scoped idempotency key used for a different request |
| 413 | `request_too_large` | Request exceeds configured size bound |
| 415 | `unsupported_media_type` | Request media type is unsupported |
| 422 | `unsupported_event_type` | Event type is not in the fixed v1 set |
| 429 | `rate_limited` | Rate budget exceeded; includes `Retry-After` |
| 500 | `internal_error` | Unexpected failure; no implementation details or secrets |
| 503 | `dependency_unavailable` | Required database, OIDC/JWKS service, key provider, or limiter is unavailable; no success-shaped fallback |

An invalid, unknown-key, or unavailable cryptographic verification is an event outcome, not a successful verification. When it is durably recorded, ingestion returns the recorded status and its separate finding; the associated risk decision is at least `VERIFY` for `INVALID` and `UNKNOWN_KEY`. Replay is an ingested event outcome, returns `201 Created`, is `FLAG`, and produces a replay finding. If the system cannot durably record required event/finding state, it returns an explicit 5xx and does not claim success. OIDC/JWKS unavailability fails authentication closed and returns `503`, not an unauthenticated success.

## Endpoints and authorization

The required role **and** OAuth scope must both be present. `ADMIN` has no decrypt permission by default and no endpoint below grants decrypt or secret export.

### Role permission matrix

| Role | Ingest events | Read events/findings | Read keys/inventory/CBOM | Manage keys | Write CBOM | Read audit |
|---|---:|---:|---:|---:|---:|---:|
| `ADMIN` | No | Yes | Yes | Yes | Yes | Yes |
| `SECURITY_ANALYST` | No | Yes | Yes | No | Yes | No |
| `AUDITOR` | No | Yes | Yes | No | No | Yes |
| `SERVICE` | Yes | No | No | No | No | No |

This matrix is a ceiling, not a grant: the endpoint-specific role and scope below, organization ownership, and any resource-level policy must all allow the operation. No role receives decrypt or secret-export permission by default.

| Method and path | Purpose | Required role | Required scope |
|---|---|---|---|
| `POST /api/v1/events` | Synchronously ingest, verify, score, and persist event | `SERVICE` | `events:write` |
| `GET /api/v1/events` | List tenant-visible events | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `events:read` |
| `GET /api/v1/events/{event_id}` | Read one tenant-visible event and recorded outcome | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `events:read` |
| `GET /api/v1/findings` | List tenant security findings | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `findings:read` |
| `GET /api/v1/findings/{finding_id}` | Read one tenant finding | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `findings:read` |
| `GET /api/v1/keys` | List key metadata/lifecycle, never secret bytes | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `keys:read` |
| `POST /api/v1/keys` | Register a provider-backed key reference/metadata | `ADMIN` | `keys:write` |
| `POST /api/v1/keys/{key_id}/rotate` | Request provider-backed key rotation | `ADMIN` | `keys:write` |
| `POST /api/v1/keys/{key_id}/disable` | Disable a key reference | `ADMIN` | `keys:write` |
| `GET /api/v1/inventory` | List cryptographic asset metadata | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `inventory:read` |
| `GET /api/v1/cboms` | List tenant CBOM snapshots | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `cbom:read` |
| `GET /api/v1/cboms/{cbom_id}` | Read a tenant CBOM snapshot | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `cbom:read` |
| `POST /api/v1/cboms` | Submit a validated CBOM snapshot | `ADMIN`, `SECURITY_ANALYST` | `cbom:write` |
| `GET /api/v1/audit-records` | Read redacted tenant audit history | `ADMIN`, `AUDITOR` | `audit:read` |

No write access to events/findings or arbitrary role administration is implied by read roles. `SECURITY_ANALYST` cannot create/rotate/disable keys. `AUDITOR` is read-only. `SERVICE` cannot read interactive administrative resources. Every endpoint also enforces the identity's organization against the target row.

## Endpoint-specific request/response shapes

- `GET` collection endpoints accept `limit` and `cursor` and return `{ "items": [...], "next_cursor": "..." }`.
- Event GET resources use the event response shape above; listing items may omit large metadata but retain event ID, type, timestamps, verification status, and risk decision.
- Finding response: `{ "id": "uuid", "event_id": "uuid|null", "kind": "verification_failed|unknown_key|verification_unavailable|replay|...", "severity": "LOW|MEDIUM|HIGH|CRITICAL", "created_at": "RFC3339 UTC", "status": "OPEN|ACKNOWLEDGED|RESOLVED", "summary": "redacted text" }`.
- `POST /api/v1/keys` accepts `{ "key_id": "...", "provider": "...", "algorithm": "...", "public_metadata": {} }`; it does not accept private key material. Response contains tenant key metadata and lifecycle state only.
- Key rotate/disable bodies accept an optional bounded `reason` string, not key material. Responses report the recorded operation/lifecycle state. Provider outage returns 503 and does not report rotation/disable success unless that state is durably confirmed.
- `GET /api/v1/inventory` returns paginated metadata: asset reference, type, algorithm, key reference, lifecycle, discovery/source timestamps. It excludes secrets.
- CBOM submission accepts a bounded versioned document of component identifiers, versions, cryptographic usage/algorithm metadata, and provenance; no secret or plaintext payload fields. CBOM GET returns the stored validated snapshot and provenance.
- Audit records return timestamp, actor subject, operation, target reference, and redacted outcome; no credentials or sensitive payload.
