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
| Malicious payloads | Tampering, Denial of Service, Information Disclosure | Parser abuse, oversized requests, injection, secret or plaintext leakage | C-04, C-12, C-13 |
| Insider misuse | Elevation of Privilege, Information Disclosure, Repudiation | Privileged person accesses tenant records, changes key lifecycle, or conceals actions | C-03, C-10, C-11, C-14 |
| Dependency compromise | Tampering, Denial of Service, Elevation of Privilege | Malicious or vulnerable dependency executes in the application/build | C-15, C-16 |
| Log leakage | Information Disclosure | JWTs, signatures, secrets, PAN, or plaintext appear in logs or traces | C-13, C-14 |

## Assumptions and residual risk

- OIDC issuer, PostgreSQL, and the configured KMS/HSM are independently operated trust dependencies; compromise of one can exceed application-only controls.
- Per-tenant row scoping and composite constraints limit accidental cross-tenant access but do not alone contain a fully compromised application/database administrator.
- A valid signature establishes only cryptographic validity under the selected key and algorithm. It does not establish the transaction's legitimacy, authorization, intent, or absence of replay.
- Rate limits reduce abuse but cannot guarantee availability under upstream, database, or volumetric infrastructure attacks.
- Controls listed as "how tested" are required future tests and CI checks; until implemented and executed, they are design requirements, not verified controls.
