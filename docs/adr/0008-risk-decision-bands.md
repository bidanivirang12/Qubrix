# ADR-0008: Risk bands and hard overrides

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

TrustShield needs stable decisions while recording EncryptPlus verification as a risk input. Cryptographic validity cannot establish transaction legitimacy.

## Decision

Store an integer base risk score in `[0, 100]` and return `assessment_id`, `reason_codes`, `model_version`, `ruleset_version`, `feature_version`, and `overrides_applied` with it. Map base score `0-39` to `APPROVE`, `40-69` to `VERIFY`, and `70-100` to `FLAG`. Typed, bounded, versioned features include the event-type attributes and recorded verification/replay facts; they exclude PAN, plaintext identity, credentials, signature bytes, and plaintext payloads. A `VALID` signature is recorded as an input but never subtracts from or otherwise lowers the score.

Apply hard decision overrides without falsifying the base score:

- `INVALID` and `UNKNOWN_KEY` verification force a decision of at least `VERIFY` (i.e. never `APPROVE`) and each produces its own finding. Disabled/revoked keys use `INVALID` with reason `KEY_DISABLED`/`KEY_REVOKED`.
- `MALFORMED_INPUT` and `VERIFIER_UNAVAILABLE` each produce their own finding and are recorded as inputs; neither claims validity or may be silently treated as `VALID`.
- Replay forces `FLAG` regardless of base score and verification status, and produces a replay finding.

If multiple rules apply, select the most restrictive decision (`FLAG` > `VERIFY` > `APPROVE`). Persist the base score, verification status/reason, override reasons, final decision, and all three versions separately. Analyst review is append-only and may override only the final decision, with actor and reason; it cannot change score or reduce replay/verification hard floors. A duplicate event ID submitted with another idempotency key is recorded as a replay finding and separate `FLAG` assessment attempt before returning 409 `event_id_conflict`.

## Consequences

- Tests cover boundary scores 39/40, 69/70, score range, every standardized verification state, disabled/revoked key reasons, replay precedence, review overrides/floors, versioned features, and signature validity not lowering score.
- Findings are first-class durable records, not inferred only from a decision label.
- Threshold changes require a versioned ruleset and review.
