# Qubrix threat model

## Scope, method, and status meaning

This STRIDE review covers the v1 HTTP resource server, event and crypto APIs, tenant-scoped PostgreSQL state, TrustShield assessments/findings, EncryptPlus and its key provider, OIDC/JWKS trust, and the CI/build/deployment supply chain. The threat rows describe design risks, not verified exploitability or regulatory compliance.

Likelihood and impact are qualitative design estimates: **Low**, **Medium**, or **High**. **Designed** means a control is specified in the design but is not yet demonstrated by implementation; **pending implementation** means code/configuration and tests remain to be delivered; **accepted risk** means the residual risk is explicitly retained with the stated gate/mitigation. None of these labels means a control has passed a test.

## Sensitive assets

| Asset | Security property at risk | Primary boundaries |
|---|---|---|
| Tenant organization mapping, actor and authorization claims | Confidentiality and integrity of tenant isolation and permissions | API/OIDC, API/PostgreSQL |
| Event attributes, signed canonical bytes, event IDs and nonces | Integrity, replay resistance, and minimization of personal/payment data | Client/API, API/PostgreSQL |
| Verification status, key lifecycle, risk assessments, reason codes, findings and analyst reviews | Integrity, availability, attribution, and correct risk decisions | API/PostgreSQL, API/KMS |
| KMS/HSM key handles, key metadata, ciphertext and transient plaintext | Key confidentiality, cryptographic integrity, and authorized use | API/KMS |
| JWT signing keys, JWKS cache, issuer metadata/configuration | Authentication integrity and availability | API/OIDC |
| Database contents, audit records, backups, retention and purge state | Tenant confidentiality, evidence integrity, and recoverability | API/PostgreSQL, operations |
| Idempotency records, rate-limit budgets and cursor-signing keys | Abuse resistance, availability, and tenant-bound pagination | Client/API, API/PostgreSQL |
| CBOM documents, inventory snapshots and parser resources | Integrity and availability of cryptographic inventory | Client/API, API/PostgreSQL |
| CI credentials, workflow permissions, source, dependencies, base images and release artifacts | Build integrity and deployment trust | CI/build, registry, deployment |
| Logs, traces, request IDs and correlation IDs | Confidentiality and forensic integrity | All boundaries |

## Attacker catalog

| Attacker | Capabilities and limits |
|---|---|
| Anonymous network client | Sends unauthenticated requests, malformed/oversized payloads, and traffic intended to consume ingress or pre-auth resources; cannot assert a trusted identity. |
| Authenticated tenant user | Uses valid IdP credentials and assigned scopes; attempts object-ID guessing, attribute shaping, replay, and privilege escalation across tenants. |
| Compromised `SERVICE` identity | Uses its valid workload token/scopes and may submit large volumes of events or invoke crypto operations permitted to that identity; cannot be assumed benign because authentication succeeded. |
| Malicious or mistaken `ADMIN` | Performs permitted administrative key and finding operations maliciously or in error; cannot decrypt by default and must not manage tenant/role grants through Qubrix. |
| Insider with database access | Reads or alters database rows, audit records, backups, or purge state according to granted DB/operations privileges; database controls cannot fully contain a database superuser. |
| Compromised dependency or CI | Introduces malicious code, action, package, secret exfiltration, or image into build/release; may gain deployment credentials if workflows are overprivileged. |

## Abuse cases

| Abuse case | Likelihood | Impact | Status | Controls |
|---|---|---|---|---|
| Send `alg=none`, a token with a mismatched key type, or a JWT naming an attacker-controlled issuer/JWKS URL | Medium | High | pending implementation | C-22 JWT algorithm and issuer policy; C-24 Pinned issuer and JWKS fetch policy |
| Change organization/role/scope claims or body properties to target another tenant | Medium | High | pending implementation | C-02 Trusted identity claims; C-03 Route/object authorization; C-23 Claim-to-tenant mapping |
| Submit the same event ID with a fresh HTTP idempotency key, omit a nonce, or race the same key | Medium | High | pending implementation | C-09 Replay identities; C-10 Idempotency state; C-19 Event time and contract errors |
| Send malformed signed bytes and observe status/timing differences to discover key existence or provider state | Medium | Medium | pending implementation | C-07 Explicit verification outcomes; C-31 Verification oracle resistance |
| Shape valid typed attributes to stay below a risk threshold or flood `FLAG` events to overwhelm analysts | Medium | Medium | pending implementation | C-29 Risk feature governance; C-30 Alert volume controls |
| Invoke rotate/disable repeatedly using an ADMIN token or request decrypt using a human token | Medium | High | pending implementation | C-27 Key lifecycle safeguards; C-28 Crypto endpoint policy |
| Submit a giant/nested CBOM, poison algorithm metadata, or attempt to alter another tenant's inventory | Medium | High | pending implementation | C-21 Route permission matrix; C-33 CBOM parser isolation |
| Exhaust idempotency/nonce stores, exploit event-time clock skew, or force the database rate limiter to do work before authentication | Medium | High | pending implementation | C-19 Event time and contract errors; C-25 Pre-auth edge limits and limiter ordering |
| Enable development IdP or software key provider in production | Low | High | pending implementation | C-34 Production provider configuration gate |
| Alter/delete audit rows directly or purge backups before the retention/hold window | Medium | High | pending implementation | C-32 Independent audit and backup protection; C-35 Retention and purge safety |
| Compromise an Actions workflow, third-party action, secret, or base image | Medium | High | pending implementation | C-36 CI supply-chain hardening |
| Select an immature post-quantum library because it is available | Medium | High | accepted risk | C-37 Post-quantum selection gate |

## Cross-cutting threat register

Every row has a likelihood, impact, status, and named control(s). Control names and IDs resolve to [security-controls.md](./security-controls.md).

| Threat | STRIDE | Scenario | Likelihood | Impact | Status | Controls |
|---|---|---|---|---|---|---|
| Account takeover and JWT algorithm confusion, including `alg=none` | Spoofing, Elevation of Privilege | Forged/altered bearer token is accepted or stolen token is misused | Medium | High | pending implementation | C-01 JWT/JWKS validation; C-22 JWT algorithm and issuer policy |
| Tenant or role claim confusion | Elevation of Privilege, Information Disclosure | Untrusted issuer, claim mapping, or body value changes tenant or permission | Medium | High | pending implementation | C-02 Trusted identity claims; C-03 Route/object authorization; C-23 Claim-to-tenant mapping |
| JWKS cache poisoning or SSRF via issuer/JWKS URL configuration | Spoofing, Tampering, Denial of Service | Attacker-controlled metadata redirects key fetch or poisons cache | Low | High | pending implementation | C-01 JWT/JWKS validation; C-24 Pinned issuer and JWKS fetch policy |
| Broken object-level authorization | Elevation of Privilege, Information Disclosure | Caller guesses another tenant's event, finding, assessment, key, or CBOM ID | Medium | High | pending implementation | C-03 Route/object authorization; C-04 Tenant-scoped persistence |
| Forged event and signed-field ambiguity | Spoofing, Tampering | Client changes an event, field, or organization while retaining a signature | Medium | High | pending implementation | C-05 Strict event schemas; C-06 Canonical signed-message verification |
| Signature canonicalization ambiguity or unbound fields | Tampering, Repudiation | Different parsers canonicalize differently, duplicate JSON keys, or a material field is omitted from signature | Medium | High | pending implementation | C-06 Canonical signed-message verification |
| Algorithm downgrade or silent provider fallback | Tampering, Spoofing | Unsupported algorithm or provider failure silently selects weaker verification | Low | High | pending implementation | C-06 Canonical signed-message verification; C-26 No downgrade/provider fallback |
| Disabled/revoked key or verification failure reported as valid | Spoofing, Tampering | Lifecycle state, malformed input, unknown key, or outage is misrepresented | Medium | High | pending implementation | C-07 Explicit verification outcomes; C-26 No downgrade/provider fallback |
| Replay and event-ID/idempotency races | Spoofing, Tampering, Denial of Service | Re-keyed/retried event or nonce bypasses uniqueness under concurrency | Medium | High | pending implementation | C-09 Replay identities; C-10 Idempotency state |
| Pre-authentication denial of service against DB-backed limiter | Denial of Service | Anonymous traffic forces database-backed per-tenant limiter work before identity exists | Medium | High | pending implementation | C-11 Authenticated DB rate budgets; C-25 Pre-auth edge limits and limiter ordering |
| Idempotency key flooding | Denial of Service | Attacker creates many distinct keys to exhaust idempotency rows/indexes | Medium | Medium | pending implementation | C-10 Idempotency state; C-25 Pre-auth edge limits and limiter ordering |
| Nonce store exhaustion and clock-skew edge cases | Denial of Service, Spoofing | Unique nonces exhaust storage or accepted timestamp skew broadens replay window | Medium | High | pending implementation | C-09 Replay identities; C-19 Event time and contract errors; C-25 Pre-auth edge limits and limiter ordering |
| Compromised SERVICE credential | Spoofing, Elevation of Privilege, Repudiation | Valid workload token is used for unauthorized event volume or crypto operation | Medium | High | pending implementation | C-01 JWT/JWKS validation; C-03 Route/object authorization; C-11 Authenticated DB rate budgets; C-21 Route permission matrix |
| ADMIN token abuse of key rotate/disable | Elevation of Privilege, Repudiation | Permitted but harmful lifecycle operation disables or rotates tenant keys | Medium | High | pending implementation | C-15 Append-only audit; C-21 Route permission matrix; C-27 Key lifecycle safeguards |
| Decrypt endpoint abuse | Elevation of Privilege, Information Disclosure | Human or compromised service obtains plaintext through crypto decrypt | Medium | High | pending implementation | C-14 Sensitive-data handling; C-21 Route permission matrix; C-28 Crypto endpoint policy |
| Risk evasion by shaping event attributes | Tampering, Repudiation | Valid but adversarial attribute values evade risk rules or exploit missing features | Medium | High | pending implementation | C-05 Strict event schemas; C-08 Risk floors and review; C-29 Risk feature governance |
| Alert flooding with FLAG events | Denial of Service | High-volume flag events overwhelm triage and obscure serious cases | Medium | Medium | pending implementation | C-08 Risk floors and review; C-11 Authenticated DB rate budgets; C-30 Alert volume controls |
| Verification-error oracle | Information Disclosure | Response detail/timing reveals key existence, lifecycle, or signature validity | Medium | Medium | pending implementation | C-07 Explicit verification outcomes; C-12 Bounded validation errors; C-31 Verification oracle resistance |
| Audit record tampering or deletion | Tampering, Repudiation | Insider or compromised DB credential changes evidence of privileged action | Medium | High | pending implementation | C-15 Append-only audit; C-32 Independent audit and backup protection |
| CBOM submission poisoning and parser bombs | Tampering, Denial of Service | Malformed/deep/oversized CBOM poisons inventory or exhausts parser resources | Medium | High | pending implementation | C-12 Bounded inputs; C-21 Route permission matrix; C-33 CBOM parser isolation |
| Development IdP or software key provider enabled in production | Spoofing, Tampering | Weak development identity/key provider is accidentally deployed | Low | High | pending implementation | C-01 JWT/JWKS validation; C-26 No downgrade/provider fallback; C-34 Production provider configuration gate |
| Backup retention and purge job risks | Information Disclosure, Tampering, Denial of Service | Backups outlive policy or purge deletes evidence/data too early | Medium | High | pending implementation | C-04 Tenant-scoped persistence; C-32 Independent audit and backup protection; C-35 Retention and purge safety |
| Compromised CI actions, secrets, or base images | Tampering, Elevation of Privilege, Information Disclosure | Build workflow leaks secrets or publishes malicious artifact | Medium | High | pending implementation | C-16 Reproducible dependency pipeline; C-17 Container build and scan; C-36 CI supply-chain hardening |
| Post-quantum library immaturity | Tampering, Denial of Service | Immature/non-interoperable implementation is enabled prematurely | Medium | High | accepted risk | C-26 No downgrade/provider fallback; C-37 Post-quantum selection gate |
| Log leakage | Information Disclosure | JWTs, signatures, secrets, PAN, plaintext, or decrypted data enters telemetry | Medium | High | pending implementation | C-14 Sensitive-data handling; C-18 Request correlation and auth response |
| Analyst override abuse | Elevation of Privilege, Repudiation, Tampering | Analyst lowers a hard floor or changes outcome without reason/evidence | Low | High | pending implementation | C-08 Risk floors and review; C-15 Append-only audit; C-20 Analyst review safeguards |
| Cursor tampering or tenant pivot | Elevation of Privilege, Information Disclosure | Forged cursor changes tenant/filter scope or bypasses pagination bounds | Low | High | pending implementation | C-03 Route/object authorization; C-13 HMAC-signed cursors |
| Unauthorized inventory/CBOM export | Information Disclosure, Elevation of Privilege | Caller reads or generates another tenant's snapshot | Medium | High | pending implementation | C-03 Route/object authorization; C-21 Route permission matrix |
| Dependency compromise | Tampering, Denial of Service, Elevation of Privilege | Malicious package executes in app or build | Medium | High | pending implementation | C-16 Reproducible dependency pipeline; C-17 Container build and scan; C-36 CI supply-chain hardening |

## Per-boundary STRIDE tables

Each row includes qualitative likelihood/impact, status, and the control name beside its ID.

### Client to API

| Threat | STRIDE | Scenario | Likelihood | Impact | Status | Controls |
|---|---|---|---|---|---|---|
| JWT algorithm confusion / stolen token | Spoofing, Elevation of Privilege | `alg=none`, key confusion, or credential theft gains API access | Medium | High | pending implementation | C-01 JWT/JWKS validation; C-22 JWT algorithm and issuer policy |
| Claim confusion / broken object authorization | Elevation of Privilege, Information Disclosure | Forged tenant/role context or guessed resource ID crosses tenant | Medium | High | pending implementation | C-02 Trusted identity claims; C-03 Route/object authorization; C-23 Claim-to-tenant mapping |
| Forged, ambiguous, or replayed signed event | Spoofing, Tampering | Changed canonical fields, omitted nonce, event ID replay, or algorithm fallback accepted | Medium | High | pending implementation | C-06 Canonical signed-message verification; C-09 Replay identities; C-26 No downgrade/provider fallback |
| Request floods and idempotency/nonce exhaustion | Denial of Service | Anonymous/authenticated traffic consumes ingress, DB limiter, or uniqueness stores | Medium | High | pending implementation | C-10 Idempotency state; C-11 Authenticated DB rate budgets; C-19 Event time and contract errors; C-25 Pre-auth edge limits and limiter ordering |
| Attribute shaping or FLAG flooding | Tampering, Denial of Service | Manipulated valid fields evade scoring or flood analyst queues | Medium | Medium | pending implementation | C-05 Strict event schemas; C-29 Risk feature governance; C-30 Alert volume controls |
| Decrypt, finding, or analyst action abuse | Elevation of Privilege, Information Disclosure | Human or overbroad identity invokes sensitive API action | Medium | High | pending implementation | C-03 Route/object authorization; C-20 Analyst review safeguards; C-21 Route permission matrix; C-28 Crypto endpoint policy |

### API to PostgreSQL

| Threat | STRIDE | Scenario | Likelihood | Impact | Status | Controls |
|---|---|---|---|---|---|---|
| Cross-tenant query or constraint gap | Elevation of Privilege, Information Disclosure, Tampering | Missing organization predicate or tenantless FK exposes/changes another tenant's rows | Medium | High | pending implementation | C-03 Route/object authorization; C-04 Tenant-scoped persistence |
| Rate-limiter database exhaustion | Denial of Service | Requests reach DB-backed limiter before authentication or create unbounded counters | Medium | High | pending implementation | C-11 Authenticated DB rate budgets; C-25 Pre-auth edge limits and limiter ordering |
| Idempotency/replay state exhaustion or race | Denial of Service, Tampering | Unbounded rows or concurrent uniqueness races cause outage/duplicate processing | Medium | High | pending implementation | C-09 Replay identities; C-10 Idempotency state; C-25 Pre-auth edge limits and limiter ordering |
| Audit tampering, backup exposure, or premature purge | Tampering, Repudiation, Information Disclosure | DB insider alters evidence or backup lifecycle violates retention/hold | Medium | High | pending implementation | C-15 Append-only audit; C-32 Independent audit and backup protection; C-35 Retention and purge safety |
| Plaintext or secrets persisted | Information Disclosure | Sensitive request/crypto output lands in event, JSONB, or audit storage | Low | High | pending implementation | C-05 Strict event schemas; C-14 Sensitive-data handling |

### API to KMS/HSM provider

| Threat | STRIDE | Scenario | Likelihood | Impact | Status | Controls |
|---|---|---|---|---|---|---|
| Silent algorithm downgrade/provider fallback | Tampering, Spoofing | Provider adapter substitutes an algorithm or local software key after failure | Low | High | pending implementation | C-06 Canonical signed-message verification; C-26 No downgrade/provider fallback |
| Disabled/revoked key reported VALID | Spoofing, Tampering | Provider lifecycle state is stale or ignored | Medium | High | pending implementation | C-07 Explicit verification outcomes; C-27 Key lifecycle safeguards |
| Decrypt abuse or plaintext leakage | Elevation of Privilege, Information Disclosure | Excessive identity permissions or telemetry exposes plaintext | Medium | High | pending implementation | C-14 Sensitive-data handling; C-28 Crypto endpoint policy |
| Provider outage/error oracle | Information Disclosure, Denial of Service | Different errors reveal key state or unavailable service blocks ingestion | Medium | Medium | pending implementation | C-07 Explicit verification outcomes; C-31 Verification oracle resistance |
| Development/software provider in production | Spoofing, Tampering | Development provider or test key is selected by production config | Low | High | pending implementation | C-34 Production provider configuration gate |

### API to OIDC/JWKS

| Threat | STRIDE | Scenario | Likelihood | Impact | Status | Controls |
|---|---|---|---|---|---|---|
| JWT algorithm confusion | Spoofing, Elevation of Privilege | Token algorithm/key type bypasses issuer signature policy | Low | High | pending implementation | C-01 JWT/JWKS validation; C-22 JWT algorithm and issuer policy |
| Tenant/role claim confusion | Elevation of Privilege | Issuer claim is ambiguous, missing, or mapped to wrong tenant/roles | Medium | High | pending implementation | C-02 Trusted identity claims; C-23 Claim-to-tenant mapping |
| JWKS cache poisoning | Spoofing, Tampering | Untrusted key material replaces configured issuer keys | Low | High | pending implementation | C-01 JWT/JWKS validation; C-24 Pinned issuer and JWKS fetch policy |
| SSRF through issuer/JWKS URL configuration | Spoofing, Information Disclosure, Denial of Service | Configured metadata URL reaches internal or attacker-controlled endpoint | Low | High | pending implementation | C-24 Pinned issuer and JWKS fetch policy |
| Issuer/JWKS outage | Denial of Service | Authentication dependency is unavailable | Medium | Medium | designed | C-01 JWT/JWKS validation; C-24 Pinned issuer and JWKS fetch policy |

### CI/build to registry and deployment

| Threat | STRIDE | Scenario | Likelihood | Impact | Status | Controls |
|---|---|---|---|---|---|---|
| Compromised CI action or workflow permission | Tampering, Elevation of Privilege | Workflow can alter artifacts or access deployment credentials | Medium | High | pending implementation | C-16 Reproducible dependency pipeline; C-36 CI supply-chain hardening |
| Secret leakage in workflow | Information Disclosure | Build/test/deploy secret is printed or exfiltrated | Medium | High | pending implementation | C-14 Sensitive-data handling; C-36 CI supply-chain hardening |
| Malicious dependency/base image | Tampering, Denial of Service | Compromised package or image enters release artifact | Medium | High | pending implementation | C-16 Reproducible dependency pipeline; C-17 Container build and scan; C-36 CI supply-chain hardening |
| Unreviewed artifact deployed | Tampering, Repudiation | Registry artifact lacks provenance or approval | Low | High | pending implementation | C-17 Container build and scan; C-36 CI supply-chain hardening |
| Immature post-quantum dependency enabled | Tampering, Denial of Service | Library selected without interoperability/security maturity evidence | Medium | High | accepted risk | C-26 No downgrade/provider fallback; C-37 Post-quantum selection gate |

## Review rule and residual risk

The **Security Architect** owns this threat model and control mapping. Revisit and approve the model before release whenever a trust boundary, API endpoint, identity claim/issuer, KMS/HSM provider, persistence boundary, CI action/base image, or deployment path changes; also review at least annually and after a material security incident. The service owner supplies change details; the Security Architect records residual-risk acceptance and updates affected STRIDE rows and tests.

- OIDC issuer, PostgreSQL, and the configured KMS/HSM are independently operated trust dependencies; compromise of one may exceed application-only controls.
- Database superusers and CI/deployment administrators remain high-impact insiders; separation of duties and independent audit/backup controls are required.
- Post-quantum library immaturity is an accepted risk only while such algorithms remain disabled; enabling one requires the ADR-0007 selection gate and a superseding ADR.
- Rate limits cannot guarantee availability during upstream, database, or volumetric infrastructure attacks. Pre-auth ingress limits must protect the database-backed limiter from anonymous traffic.
- The database-backed limiter runs only after trusted identity is established; coarse pre-authentication limits are applied at ingress as recorded in [ADR-0006](./adr/0006-database-backed-rate-limiting.md).
- All controls and test paths are design requirements until implemented and their tests and CI checks have actually run. This document makes no regulatory compliance claim.
