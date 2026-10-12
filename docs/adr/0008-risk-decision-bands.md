# ADR-0008: Risk bands and hard overrides

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

TrustShield needs stable decisions while recording EncryptPlus verification as a risk input. Cryptographic validity cannot establish transaction legitimacy.

## Decision

Store an integer base risk score in `[0, 100]` and a versioned model/rule identifier. Map base score `0-39` to `APPROVE`, `40-69` to `VERIFY`, and `70-100` to `FLAG`. A `VALID` signature is recorded as an input but never subtracts from or otherwise lowers the score.

Apply hard decision overrides without falsifying the base score:

- `INVALID` and `UNKNOWN_KEY` verification force a decision of at least `VERIFY` (i.e. never `APPROVE`) and each produces its own finding.
- `UNAVAILABLE` verification produces its own finding and is recorded as an input; absent an independently specified threshold it does not claim validity and cannot be silently treated as `VALID`.
- Replay forces `FLAG` regardless of base score and verification status, and produces a replay finding.

If multiple rules apply, select the most restrictive decision (`FLAG` > `VERIFY` > `APPROVE`). Persist the base score, verification status, override reasons, final decision, and model version separately.

## Consequences

- Tests cover boundary scores 39/40, 69/70, score range, each verification state, replay precedence, and signature validity not lowering score.
- Findings are first-class durable records, not inferred only from a decision label.
- Threshold changes require a versioned ruleset and review.
