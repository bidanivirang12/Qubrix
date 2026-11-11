# ADR-0013: Subject revocation and authentication telemetry

- **Status:** Accepted
- **Date:** 2026-11-11

## Context

Validated IdP tokens can remain valid until expiry, while operators need subject-level disablement and a way to revoke all previously issued tokens. Authentication failures before a trusted identity exists cannot be written to tenant audit records because they have no trustworthy tenant or actor and would violate the audit foreign key and attribution constraints.

## Decision

Roles and scopes remain exclusively in the validated token; there is no local role-assignment table. Add `identity_status`, keyed by `(organization_id, subject)`, with nullable `disabled_at` and `tokens_valid_after`. A missing row is allowed. Reject a subject if disabled or if the validated token's `iat` precedes `tokens_valid_after`. Cache organization provisioning and subject status for `QUBRIX_REVOCATION_CACHE_SECONDS` (default 30 seconds, maximum 300 seconds); changes therefore take effect within at most that cache lifetime. If PostgreSQL cannot answer a status check, fail closed with 503. The runtime role has SELECT only on this table. Administrators change rows as the owner role using the approved database administration channel, for example:

```sql
INSERT INTO identity_status (organization_id, subject, disabled_at, tokens_valid_after)
VALUES ('<organization-uuid>', '<IdP-subject>', NULL, now())
ON CONFLICT (organization_id, subject) DO UPDATE
SET tokens_valid_after = EXCLUDED.tokens_valid_after;
```

Failures before signature verification and trusted organization/subject parsing are security telemetry, not audit facts. A bounded in-process aggregator emits at most one redacted structured line per minute per fixed reason category and salted 64-way address bucket. The salt is required in production and is never logged. No database writes occur on this path. Authorization denials and disabled/revoked subjects use `audit_records` with the validated organization and subject, subject to a per-subject fixed-window `audit_denial` budget. An unknown organization is denied with 403 and telemetry only. Audit insertion errors are logged at error level but never change a denial into success.

## Consequences

- `audit_records` remains unchanged: organization and actor are required, and the runtime role retains SELECT and INSERT only.
- Anonymous or otherwise untrusted requests never create audit rows or database writes.
- A database outage can temporarily delay status changes for already-cached subjects by no more than the configured cache lifetime; after expiry, the check fails closed.
- The pre-auth limiter is process-local and bounded; production ingress/gateway controls remain necessary against volumetric floods.
- Security telemetry contains only enumerated reason categories, coarse salted address buckets, and counts—never raw addresses, tokens, or claim values.
