# ADR-0007: Gate for post-quantum algorithm selection

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

EncryptPlus needs explicit algorithm handling and a migration path, but selecting a post-quantum scheme or hybrid mode without provider, interoperability, and deployment evidence would be speculative.

## Decision

Do not select or invent a post-quantum algorithm in this design phase. Before selection, require documented standards status, vetted maintained library/provider support, key custody and lifecycle support, interoperability with counterparties, threat/security review, performance measurements on target deployment, migration/rotation and downgrade-resistance plan, and versioned API/data compatibility. Accept only explicitly configured allowlisted algorithms. A missing capability or unsupported algorithm fails closed; never silently downgrade.

## Consequences

- Algorithm identifiers are recorded explicitly in key metadata and verification results.
- The provider interface isolates future algorithm/provider choices.
- An implementation proposal must satisfy the gate and be recorded in a superseding ADR before enabling a post-quantum or hybrid algorithm.
