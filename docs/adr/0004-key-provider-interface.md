# ADR-0004: Provider-backed cryptographic key boundary

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

EncryptPlus must verify cryptographic material without turning Qubrix application code or PostgreSQL into a secret-key store. Provider details may differ by deployment.

## Decision

Define a narrow key-provider interface around opaque tenant-scoped key references and explicit verify, encrypt, decrypt, and lifecycle operations. Production provider implementation is an external KMS/HSM integration selected through deployment configuration. Persist provider references and public/non-secret metadata only. Secret/private key bytes never enter application persistence, logs, or responses. Use established cryptographic libraries/provider APIs; algorithm identifiers are explicit and allowlisted. Signed-event v1 uses exactly `ED25519`, `ECDSA_P256_SHA256` (P-256/SHA-256/DER), and `RSA_PSS_SHA256_3072` (minimum modulus 3072 bits, SHA-256, 32-byte salt). Unsupported algorithms, provider errors, malformed input, or unknown keys fail closed; no algorithm downgrade or local secret-key fallback is allowed.

Verification outcomes are `VALID`, `INVALID`, `UNKNOWN_KEY`, `MALFORMED_INPUT`, and `VERIFIER_UNAVAILABLE`. A known disabled or revoked key returns `INVALID` with reason `KEY_DISABLED` or `KEY_REVOKED`; neither may be represented as `VALID`. Every non-VALID result creates its own finding. Encryption/decryption plaintext is transient and bounded, never persisted or logged. Decrypt is exposed only to a SERVICE identity with explicitly granted `crypto:decrypt`; no human role receives it by default.

No specific commercial provider or post-quantum algorithm is selected in this ADR.

## Consequences

- Provider adapters can be contract-tested without exposing secrets.
- Provider timeout, malformed input, unknown key, and disabled/revoked key produce their standardized status/reason and independent finding when durable recording is possible.
- Key lifecycle operations require audit records and explicit reconciliation of uncertain external outcomes.
- Key lifecycle events are reports only and never mutate key state; separately authorized lifecycle operations perform changes.
- Ciphertext and plaintext APIs increase confidentiality risk; enforce strict service authorization, bounded transient handling, and redaction.
