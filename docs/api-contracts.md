# API contracts

## Common contract

- Business endpoints use `/api/v1`; liveness/readiness probes are documented separately below. The service is an OIDC bearer-token resource server; it has no local-password or tenant/role administration endpoints.
- Validate JWT signature via configured issuer JWKS, issuer, audience, expiry/not-before, and accepted signing algorithm. The JWT `organization_id` claim is mapped through trusted server-side tenant provisioning; actor is `sub`; roles are the `roles` string array; scopes are the OAuth `scope` space-delimited string. These claims are accepted only after token validation. Tenant, actor, roles, and scopes never come from request bodies. Role and tenant management lives in the IdP/provisioning system, not this API.
- Each JSON request body has required `schema_version: 1` and a client-generated UUID `correlation_id`; nested typed objects reject unknown fields (`extra=forbid`). `correlation_id` is trace metadata, not identity, authorization, or signed event content. Identity claims, server fields, outcomes, risk decisions, findings, and keys are not client-settable.
- Every API JSON success response includes server-generated `request_id`; event responses also echo the validated `correlation_id`. `X-Request-ID` matches the JSON field. Every RFC 9457 error includes the `request_id` extension and matching header. Never include credentials, signature bytes, or key bytes in errors or logs. Plaintext may appear only in the explicit transient decrypt success response to an authorized service identity; never log or persist it.
- Timestamps use RFC 3339 UTC; IDs are UUIDs. Event timestamps more than 5 minutes in the future or older than the configured 30-day ingestion window return `400 timestamp_out_of_window`; bounds are configuration and can be tightened, not silently widened per request.
- All client-supplied event fields and crypto input are bounded; no PAN or plaintext identity data is accepted. Transient `plaintext_b64` is accepted only by the encrypt endpoint and transient plaintext is returned only by the decrypt endpoint to an authorized service identity. Those bytes are never persisted, logged, or included in traces. Sensitive data is never stored as plaintext.
- Lists use `limit` (default 50, maximum 200) and opaque `cursor`. `limit > 200` returns `400 limit_exceeded` (never clamp); invalid/tampered cursor returns `400 invalid_cursor`. Cursors contain query/position/tenant context and a key version, encoded and HMAC-SHA-256 signed with a server-held secret using a vetted library; verify in constant time. Cursors cannot be moved across organizations, filters, or ordering.
- `POST /api/v1/events` and `POST /api/v1/crypto/verify` require `Idempotency-Key` (1-128 visible ASCII characters). It is scoped by organization + actor + operation. Fingerprint the canonical validated request, excluding server-assigned fields and trace-only `correlation_id`. Completed request with same key and same fingerprint returns the original committed status/body; same key with a different fingerprint returns `409 idempotency_conflict`. Same key and fingerprint while processing returns `409 idempotency_in_progress` plus `Retry-After`; client may retry. A previously seen `(organization_id, event_id)` with a different idempotency key returns `409 event_id_conflict`, even if the payload is identical. Same idempotency key replay is resolved before this event-ID check. A new key never bypasses nonce/replay detection. Missing header returns `400 idempotency_key_required`.
- When `signature` is present, `nonce` is required; missing it returns `400 nonce_required`. Signed event IDs and nonces are tenant-scoped replay identities retained for the configured protection window. Reuse of a nonce with a new event ID is persisted as a separate event/finding and returns `201` with final decision `FLAG`. Reuse of an event ID under a different idempotency key returns `409 event_id_conflict` with a replay finding and `FLAG` assessment reference; neither path is an idempotency conflict.
- Rate-limited responses use 429 `rate_limited` and `Retry-After` seconds. Budgets are keyed by organization, principal, and route class. Exact quotas are deployment configuration.
- All request validation failures (malformed JSON, missing/extra/invalid fields, unsupported event type, invalid cursor/limit, timestamp window, and required nonce/header) use **400** `application/problem+json`; no request validation uses 422. Operational conflicts use 409; authentication, authorization, not-found, rate-limit, and dependency failures use their dedicated statuses below.

## Event request schemas

Event objects are discriminated by `event_type`; `attributes` is a required typed object specific to the event type. All attributes models reject unknown properties, are bounded, and contain no PAN or plaintext identity data.

Common event fields:

| Field | Type and constraint |
|---|---|
| `schema_version` | Required integer literal `1` |
| `correlation_id` | Required UUID; client trace identifier only |
| `event_id` | Required UUID, unique per organization for accepted first attempts |
| `event_type` | Required one of the four listed event types |
| `occurred_at` | Required RFC 3339 timestamp |
| `subject_ref` | Optional opaque/tokenized reference, max 128 characters; never name, email, phone, account number, or PAN |
| `payload_digest` | Optional base64url digest; never carries the payload itself |
| `nonce` | Required for any signed event: base64url opaque value decoding to 16-64 bytes |
| `signature` | Optional envelope; if present, requires every field in the signature envelope below |
| `attributes` | Required event-type-specific typed object with `extra=forbid` |

`organization_id`, `actor_subject`, `received_at`, verification state, score, assessment, decision, findings, and key lifecycle state are absent from the client schema. The server derives organization/actor from identity and assigns `received_at`.

### `TRANSACTION_ATTEMPT` attributes

```json
{
  "amount_minor": 1250,
  "currency": "USD",
  "channel": "WEB",
  "country_code": "US",
  "device_ref": "opaque-device-token",
  "auth_method": "MFA"
}
```

`amount_minor` is required integer `0..999999999999`; `currency` is required uppercase ISO 4217 alpha-3; `channel` is required enum `WEB|MOBILE|POS|API|OTHER`; `country_code` is optional ISO 3166-1 alpha-2; `device_ref` is optional tenant-scoped opaque token (max 128); `auth_method` is optional enum `PASSWORD|PASSKEY|MFA|API_KEY|NONE|OTHER`. No card number or payment credentials are accepted.

### `LOGIN_ATTEMPT` attributes

`auth_method` is required using the enum above; `outcome` is required enum `SUCCESS|FAILURE|CHALLENGE`; `channel` is required using the transaction channel enum; `country_code` and `device_ref` are optional with the same constraints; `factor_count` is optional integer `0..8`. No username, email, password, IP address, or plaintext identity field is accepted.

### `SIGNED_MESSAGE_RECEIVED` attributes

`message_purpose` is required enum `TRANSACTION_AUTHORIZATION|AUTHENTICATION|KEY_ATTESTATION|OTHER`; `payload_size_bytes` is required integer `0..1048576`; `sender_ref` is optional opaque token (max 128); `content_type` is optional enum `APPLICATION_JSON|APPLICATION_CBOR|OTHER`. A signature and nonce are required for this event type. The actual plaintext message is not part of the event request; sign its digest.

### `KEY_LIFECYCLE_CHANGE` attributes

`key_ref` is required tenant-scoped opaque key reference (max 128); `action` is required enum `REGISTERED|ROTATION_REQUESTED|ROTATED|DISABLE_REQUESTED|DISABLED|REVOCATION_REQUESTED|REVOKED`; `reported_status` is required enum `REQUESTED|SUCCEEDED|FAILED`; `change_source` is required enum `ADMIN|PROVIDER|AUTOMATION|OTHER`; `reason_code` is optional bounded code (max 64). Ingesting this event only records the report, risk assessment, and findings; **it never mutates key state**. Only the authenticated key-management operations change local/provider key state.

### Signature envelope and signed canonical message

```json
{
  "protocol_version": "qubrix-event-signature-v1",
  "key_id": "tenant-key-reference",
  "algorithm": "ED25519",
  "value": "base64url-signature"
}
```

Version 1 signs the following complete object; absent optional values are explicit JSON `null`, and all attributes fields required by the selected event schema are present:

```json
{
  "protocol_version": "qubrix-event-signature-v1",
  "schema_version": 1,
  "organization_id": "server-resolved-organization-uuid",
  "event_id": "lowercase-uuid",
  "event_type": "TRANSACTION_ATTEMPT",
  "occurred_at": "normalized-UTC-RFC3339-timestamp",
  "nonce": "base64url-value",
  "subject_ref": null,
  "payload_digest": null,
  "attributes": {},
  "key_id": "tenant-key-reference",
  "algorithm": "ED25519"
}
```

Canonicalize this object using RFC 8785 JSON Canonicalization Scheme (JCS), UTF-8 encode the resulting bytes, and verify the signature over exactly those bytes. Normalize UUIDs to lowercase canonical form and timestamps to UTC with `Z` before canonicalization. Reject duplicate JSON keys, invalid encodings, unknown fields, floating-point attribute values, unsupported protocol versions, and any disagreement between body and signed values. `organization_id` is resolved from the verified JWT and included in the signed object, preventing cross-tenant replay. `received_at`, actor subject, correlation ID, and the signature value itself are not signed; `key_id`, algorithm, nonce, all event fields, schema version, and attributes are signed.

The v1 signature allowlist is exactly `ED25519`, `ECDSA_P256_SHA256` (P-256 ECDSA, SHA-256, DER signature encoding), and `RSA_PSS_SHA256_3072` (RSA-PSS, SHA-256, modulus at least 3072 bits, salt length exactly 32 bytes). Reject any other algorithm or key/algorithm mismatch; no negotiation, fallback, or silent downgrade. Future algorithm additions, including post-quantum/hybrid algorithms, require the ADR-0007 selection gate and a new ADR.

## Event ingestion response

```json
{
  "request_id": "uuid",
  "correlation_id": "uuid",
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
    "reason_code": null,
    "key_id": "tenant-key-reference"
  },
  "risk": {
    "assessment_id": "uuid",
    "score": 32,
    "decision": "APPROVE",
    "reason_codes": [],
    "model_version": "trustshield-model-version",
    "ruleset_version": "risk-ruleset-version",
    "feature_version": "event-features-v1",
    "overrides_applied": []
  },
  "findings": []
}
```

Verification `status` is exactly `VALID|INVALID|UNKNOWN_KEY|MALFORMED_INPUT|VERIFIER_UNAVAILABLE`. `reason_code` distinguishes known disabled/revoked keys as `KEY_DISABLED` or `KEY_REVOKED`; their status is `INVALID`, they are never `VALID`, and each creates its own finding. Every verification attempt that reaches the verifier and returns a non-VALID outcome creates an independent security finding. Structural request/schema errors rejected before verification return 400 and are not represented as a verification attempt. `INVALID` and `UNKNOWN_KEY` impose a minimum final decision of `VERIFY`; `MALFORMED_INPUT` and `VERIFIER_UNAVAILABLE` create a finding and cannot be treated as valid. A recorded verifier outage is returned as an event outcome (201 for ingestion), not a success-shaped `VALID`; if the finding cannot be committed, return 503. Replay forces `FLAG` and a separate finding. A valid signature never lowers the base score.

Risk score is integer 0-100; base bands are 0-39 `APPROVE`, 40-69 `VERIFY`, 70-100 `FLAG`. Hard overrides and analyst review do not rewrite the score. `reason_codes` and `overrides_applied` are stable code arrays, not free-form sensitive data. Analyst decision overrides are attributable and auditable and may not violate replay (`FLAG`) or invalid/unknown-key (`at least VERIFY`) floors.

## RFC 9457 errors

Errors use `application/problem+json`: RFC 9457 `type`, `title`, `status`, `detail`, `instance`, plus stable extension `code` and `request_id`. `detail` must not echo request content or sensitive data.

| HTTP | `code` | Meaning |
|---:|---|---|
| 400 | `invalid_request` | Malformed JSON or general request validation failure |
| 400 | `invalid_event_type` | `event_type` is not one of the four fixed types |
| 400 | `timestamp_out_of_window` | Event time is outside configured ingestion window |
| 400 | `nonce_required` | Signature supplied, or signed-message event, without required nonce |
| 400 | `idempotency_key_required` | Event or signed-message ingestion omitted `Idempotency-Key` |
| 400 | `limit_exceeded` | `limit` is above maximum 200; value is not clamped |
| 400 | `invalid_cursor` | Cursor is malformed, has invalid HMAC, or is bound to another query/tenant |
| 401 | `unauthenticated` | Missing/invalid bearer token or token cannot be verified |
| 403 | `forbidden` | Identity lacks required role or scope |
| 404 | `not_found` | Resource absent or not visible in caller organization |
| 409 | `idempotency_conflict` | Same scoped idempotency key is used for a different request |
| 409 | `idempotency_in_progress` | Same scoped key and request is currently processing; includes `Retry-After` |
| 409 | `event_id_conflict` | Existing organization-scoped `event_id` submitted with a different idempotency key; includes `finding_id`, `assessment_id`, and `decision: FLAG` for the replay attempt |
| 413 | `request_too_large` | Request exceeds configured body/field bound |
| 415 | `unsupported_media_type` | Request media type is unsupported |
| 429 | `rate_limited` | Rate budget exceeded; includes `Retry-After` |
| 500 | `internal_error` | Unexpected failure without internal details |
| 503 | `dependency_unavailable` | A required database, OIDC/JWKS service, rate limiter, or non-verification provider operation is unavailable; verifier outage on an ingested event is recorded as `VERIFIER_UNAVAILABLE` with a finding when persistence is available |

Every 401 includes `WWW-Authenticate: Bearer` with an appropriate safe challenge (`invalid_token` or no error detail for missing credentials). OIDC/JWKS unavailability fails closed and returns 503 rather than accepting an unverifiable token. There is no 422 validation response. `POST /api/v1/crypto/verify` returns the five-state verification outcome and, for any non-VALID verifier result, a separately persisted finding; it does not return 503 merely because signature verification is unavailable.

## Roles, scopes, and permission matrix

Both the role and named OAuth scope are required, along with organization/object authorization. `roles` is an array claim and `scope` is a space-delimited string claim in the validated JWT. This matrix is the maximum role ceiling; IdP policy may grant less. Decrypt is never granted to a human role by default. `SERVICE` is a workload identity and receives `crypto:decrypt` only through explicit IdP policy for a specific workload.

| Role | Ingest | Read events/findings/assessments | Read keys/inventory/CBOM/audit | Manage keys | Verify | Encrypt | Decrypt | Write CBOM | Generate CBOM | Finding status | Analyst review/override |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `ADMIN` | No | Yes | Yes | Yes | No | No | No | Yes | Yes | Yes | No |
| `SECURITY_ANALYST` | No | Yes | Yes | No | No | No | No | Yes | Yes | Yes | Yes |
| `AUDITOR` | No | Yes | Yes | No | No | No | No | No | No | No | No |
| `SERVICE` | Yes | No | No | No | Yes | Yes | Explicit IdP grant only | No | No | No | No |

Role/tenant creation and assignment are administered in the IdP/provisioning plane; Qubrix exposes no endpoint that manages those grants.

## Business endpoints

Every endpoint below requires its listed role(s) and scope. All resource lookups are organization-scoped.

| Method and path | Purpose | Required role | Required scope |
|---|---|---|---|
| `POST /api/v1/events` | Ingest event, verify if signed, score, persist findings | `SERVICE` | `events:write` |
| `GET /api/v1/events` | List events | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `events:read` |
| `GET /api/v1/events/{event_id}` | Read event and recorded outcome | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `events:read` |
| `POST /api/v1/crypto/verify` | Ingest a `SIGNED_MESSAGE_RECEIVED` envelope through the same verify/risk/findings pipeline | `SERVICE` | `crypto:verify` |
| `POST /api/v1/crypto/encrypt` | Provider-backed authenticated encryption of bounded transient bytes | `SERVICE` | `crypto:encrypt` |
| `POST /api/v1/crypto/decrypt` | Provider-backed decryption; no human role allowed | `SERVICE` | `crypto:decrypt` |
| `GET /api/v1/findings` | List findings | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `findings:read` |
| `GET /api/v1/findings/{finding_id}` | Read finding | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `findings:read` |
| `PATCH /api/v1/findings/{finding_id}` | Change finding status with reason | `ADMIN`, `SECURITY_ANALYST` | `findings:write` |
| `GET /api/v1/assessments` | List risk assessments | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `assessments:read` |
| `GET /api/v1/assessments/{assessment_id}` | Read full recorded assessment | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `assessments:read` |
| `POST /api/v1/assessments/{assessment_id}/review` | Append analyst review and optional permitted decision override | `SECURITY_ANALYST` | `assessments:review` |
| `GET /api/v1/keys` | List non-secret key metadata/lifecycle | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `keys:read` |
| `POST /api/v1/keys` | Register provider-backed key reference | `ADMIN` | `keys:write` |
| `POST /api/v1/keys/{key_id}/rotate` | Request provider-backed rotation | `ADMIN` | `keys:write` |
| `POST /api/v1/keys/{key_id}/disable` | Disable key | `ADMIN` | `keys:write` |
| `GET /api/v1/inventory` | List cryptographic asset metadata | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `inventory:read` |
| `GET /api/v1/cboms` | List CBOM snapshots | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `cbom:read` |
| `GET /api/v1/cboms/{cbom_id}` | Read CBOM snapshot | `ADMIN`, `SECURITY_ANALYST`, `AUDITOR` | `cbom:read` |
| `POST /api/v1/cboms` | Submit validated CBOM | `ADMIN`, `SECURITY_ANALYST` | `cbom:write` |
| `POST /api/v1/cboms/generate` | Generate a CBOM snapshot from current tenant inventory | `ADMIN`, `SECURITY_ANALYST` | `cbom:generate` |
| `GET /api/v1/audit-records` | Read redacted tenant audit history | `ADMIN`, `AUDITOR` | `audit:read` |

All JSON bodies above include `schema_version: 1` and `correlation_id`; schemas are bounded and `extra=forbid`. `POST /events` and `/crypto/verify` use the event idempotency/replay behavior described above. Crypto verify accepts only a `SIGNED_MESSAGE_RECEIVED` common event envelope and requires a nonce; it persists the event, verification, risk assessment, and any required finding. Verifier-level malformed signature encoding produces `MALFORMED_INPUT` and its own finding, while schema-invalid requests rejected before verification receive 400. Verification provider outage is persisted as `VERIFIER_UNAVAILABLE` and a finding when PostgreSQL is available. `POST /crypto/encrypt` accepts `{ "schema_version": 1, "correlation_id": "uuid", "key_id": "...", "plaintext_b64": "..." }`; it returns `ciphertext_b64`, provider algorithm, key reference, nonce, and authentication tag. `POST /crypto/decrypt` accepts the same metadata plus ciphertext/nonce/tag and returns transient `plaintext_b64`; it is never persisted/logged, PAN is forbidden, and only explicitly authorized service identities may call it. Both crypto endpoint provider failures return explicit errors and never produce a success-shaped fallback.

Finding PATCH accepts `{ "schema_version": 1, "correlation_id": "uuid", "status": "ACKNOWLEDGED|RESOLVED", "reason": "bounded non-sensitive text" }`. Assessment review accepts `{ "schema_version": 1, "correlation_id": "uuid", "review_status": "CONFIRMED|DISPUTED", "decision_override": "APPROVE|VERIFY|FLAG|null", "reason_code": "...", "rationale": "bounded non-sensitive text" }`. Original score and decision remain immutable; review is append-only, actor-attributed, and cannot lower replay/verification hard floors.

`POST /api/v1/cboms/generate` accepts `{ "schema_version": 1, "correlation_id": "uuid" }` and creates a versioned snapshot from the authenticated tenant's current inventory. Its response gives `cbom_id`, inventory version/as-of time, digest, and `request_id`. It cannot read other tenants' inventory.

### Health probes

| Method and path | Purpose | Authentication/authorization |
|---|---|---|
| `GET /health/live` | Process liveness only; no dependency details | No bearer role/scope; ingress/network restricted |
| `GET /health/ready` | Readiness for database and required configured dependencies; return generic status only | No bearer role/scope; internal ingress/network restricted |

Probes return `request_id`, expose no tenant data or dependency credentials, and are not business APIs. Readiness fails when a required dependency is unavailable.

## Pagination and response schemas

Collection success bodies contain `request_id`, optional echoed `correlation_id`, `items`, and `next_cursor` (null at end). Event responses include the envelope above. Finding bodies include IDs, event reference, kind, severity, timestamps, status, and redacted summary. Key, inventory, CBOM, and audit responses include only non-secret metadata. Assessment bodies include `assessment_id`, `event_id`, base `score`, final `decision`, `reason_codes`, `model_version`, `ruleset_version`, `feature_version`, `overrides_applied`, verification status/reason, replay state, and timestamps. Each success has `request_id`; all sensitive fields are excluded except the explicitly transient crypto decrypt result.
