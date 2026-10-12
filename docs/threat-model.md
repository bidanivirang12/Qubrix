# Threat model

## Scope and method

This STRIDE review covers the v1 HTTP resource server, event ingestion, tenant-scoped PostgreSQL state, TrustShield decisions/findings, EncryptPlus provider boundary, and build/deployment supply chain. Actors include tenant users and services, the OIDC issuer, a compromised operator/service, and hostile network clients. The table links every identified threat to a control in [security-controls.md](./security-controls.md). It is a design baseline, not a claim of regulatory compliance or a complete penetration test.

| Threat | STRIDE | Example impact | Controls |
|---|---|---|---|
| Account takeover | Spoofing, Elevation of Privilege | Stolen or forged bearer token accesses tenant data or submits events | C-01, C-02, C-03, C-10 |
| Broken object-level authorization | Elevation of Privilege, Information Disclosure | Caller guesses another tenant's event, finding, or key ID | C-02, C-03, C-04 |
| Forged events | Spoofing, Tampering | Attacker submits an event or signature that is misrepresented as verified | C-05, C-06, C-07 |
| Replay | Spoofing, Tampering | Previously observed valid message triggers duplicate processing | C-08, C-09 |
| Compromised service credentials | Spoofing, Elevation of Privilege, Repudiation | Stolen SERVICE identity submits or reads unauthorized events | C-01, C-02, C-10, C-11 |
| Malicious payloads | Tampering, Denial of Service, Information Disclosure | Unknown attributes, oversized input, canonicalization ambiguity, injection, or data leakage | C-05, C-06, C-12, C-14 |
| Verification/key-state misrepresentation | Spoofing, Tampering | Disabled/revoked key or malformed/unavailable verification is reported as `VALID` | C-06, C-07, C-08 |
| Idempotency and event replay races | Spoofing, Tampering, Denial of Service | Concurrent/re-keyed duplicate event bypasses replay handling or creates contradictory decisions | C-09, C-10 |
| Decrypt capability misuse | Elevation of Privilege, Information Disclosure | Human or overprivileged workload obtains plaintext through crypto decrypt endpoint | C-03, C-14, C-21 |
| Analyst override abuse | Elevation of Privilege, Repudiation, Tampering | Analyst lowers a hard risk floor or changes outcome without traceable reason | C-08, C-15, C-20 |
| Cursor tampering or tenant pivot | Elevation of Privilege, Information Disclosure | Forged cursor bypasses tenant/filter scope or pagination bounds | C-03, C-13 |
| Insider misuse | Elevation of Privilege, Information Disclosure, Repudiation | Privileged person accesses tenant records, changes key lifecycle, or conceals actions | C-03, C-11, C-15, C-20 |
| Unauthorized inventory/CBOM export | Information Disclosure, Elevation of Privilege | User generates or reads another tenant's cryptographic inventory snapshot | C-03, C-04, C-21 |
| Dependency compromise | Tampering, Denial of Service, Elevation of Privilege | Malicious or vulnerable dependency executes in the application/build | C-15, C-16 |
| Log leakage | Information Disclosure | JWTs, signatures, secrets, PAN, plaintext, decrypted values, or sensitive correlation context appear in logs/traces | C-14, C-18 |

## Assumptions and residual risk

- OIDC issuer, PostgreSQL, and the configured KMS/HSM are independently operated trust dependencies; compromise of one can exceed application-only controls.
- Per-tenant row scoping and composite constraints limit accidental cross-tenant access but do not alone contain a fully compromised application/database administrator.
- A valid signature establishes only cryptographic validity under the selected key and algorithm. It does not establish the transaction's legitimacy, authorization, intent, or absence of replay.
- Signed-event v1 binds protocol/schema version, server-resolved organization, event identity/type/time, nonce, subject reference, payload digest, typed attributes, key ID, and algorithm through RFC 8785 JCS; transport correlation and server receipt time are not signed.
- A `KEY_LIFECYCLE_CHANGE` event is a report only. Key state changes require separately authorized key-management operations.
- `VALID`, `INVALID`, `UNKNOWN_KEY`, `MALFORMED_INPUT`, and `VERIFIER_UNAVAILABLE` are the only verification outcomes. Disabled/revoked keys are `INVALID` with an explicit reason; no non-VALID outcome is silently mapped to success.
- Controls are design requirements and their cited test locations are planned, not existing or executed tests.
- Rate limits reduce abuse but cannot guarantee availability under upstream, database, or volumetric infrastructure attacks.
- Controls listed as "how tested" are required future tests and CI checks; until implemented and executed, they are design requirements, not verified controls.
