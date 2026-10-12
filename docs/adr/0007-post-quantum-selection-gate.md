# ADR-0007: Gate for post-quantum algorithm selection

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

EncryptPlus needs explicit algorithm handling and a migration path, but selecting a post-quantum scheme or hybrid mode without provider, interoperability, and deployment evidence would be speculative.

## Decision

Do not select a post-quantum algorithm in this design phase. The signed-event v1 allowlist is exactly `ED25519`, `ECDSA_P256_SHA256` (P-256 ECDSA, SHA-256, DER encoding), and `RSA_PSS_SHA256_3072` (RSA-PSS/SHA-256, at least 3072-bit modulus, exactly 32-byte salt). These are protocol identifiers, not negotiation preferences. A key/algorithm mismatch or unsupported identifier is rejected; no fallback or downgrade is allowed.

Before adding a post-quantum or hybrid algorithm, require documented standards status, vetted maintained library/provider support, key custody and lifecycle support, interoperability with counterparties, threat/security review, performance measurements on target deployment, migration/rotation and downgrade-resistance plan, and versioned API/data compatibility.

## Consequences

- Algorithm identifiers are recorded explicitly in key metadata and verification results.
- The provider interface isolates future algorithm/provider choices.
- An implementation proposal must satisfy the gate and be recorded in a superseding ADR before enabling a post-quantum or hybrid algorithm.
