# ADR-0004: Provider-backed cryptographic key boundary

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

EncryptPlus must verify cryptographic material without turning Qubrix application code or PostgreSQL into a secret-key store. Provider details may differ by deployment.

## Decision

Define a narrow key-provider interface around opaque tenant-scoped key references and explicit operations (initially verification and lifecycle actions). Production provider implementation is an external KMS/HSM integration selected through deployment configuration. Persist provider references and public/non-secret metadata only. Secret/private key bytes never enter application persistence, logs, or responses. Use established cryptographic libraries/provider APIs; algorithm identifiers are explicit and allowlisted. Unsupported algorithms, provider errors, or unknown keys fail closed; no algorithm downgrade or local secret-key fallback is allowed.

No specific commercial provider or post-quantum algorithm is selected in this ADR.

## Consequences

- Provider adapters can be contract-tested without exposing secrets.
- Provider timeout/unknown key is a recorded verification status and independent finding when durable recording is possible.
- Key lifecycle operations require audit records and explicit reconciliation of uncertain external outcomes.
- Decrypt/secret-export APIs are not part of v1; ADMIN has no decrypt access by default.
