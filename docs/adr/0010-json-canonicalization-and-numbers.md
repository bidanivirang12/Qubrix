# ADR-0010: JSON canonicalization and number handling

- **Status:** Accepted design; dependency verification required before implementation
- **Date:** 2026-10-12

## Context

Signed event verification requires identical bytes across producers and the resource server. Hand-written canonicalization risks differences in key order, escaping, Unicode, duplicate keys, and numeric serialization. Floating-point monetary values create representation and rounding ambiguity.

## Decision

Use RFC 8785 JSON Canonicalization Scheme (JCS) for the signed protocol-v1 object, through the maintained Python `rfc8785` package. Add it as a pinned uv dependency during the foundation phase only after verifying the package's supported Python versions, maintenance/security posture, license, and conformance vectors. Do not implement canonicalization locally and do not fall back to a different encoder if the package is unavailable or rejects input.

Reject duplicate JSON object keys before canonicalization. Validate the complete typed schema before constructing the signed object. Canonicalize UTF-8 JSON according to RFC 8785 and verify exactly those bytes. Protocol, schema, organization, event fields, typed attributes, key ID, algorithm, nonce, and payload digest are bound as specified in the API contract; transport-only correlation metadata and server receipt time are excluded.

All numeric values in signed v1 event objects are integers. Monetary values use integer minor units (`amount_minor`) only; floating-point values, fractional monetary units, NaN, and Infinity are rejected. Bound every integer to the schema range and RFC 8785/I-JSON safe integer range `[-(2^53-1), 2^53-1]`. If a future feature needs a decimal quantity, encode it as a schema-defined canonical decimal string with its own validation and new protocol/schema version; do not introduce JSON floats.

## Consequences

- Producers and verifier must pass common RFC 8785 conformance vectors and byte-for-byte signed-message test vectors.
- Attribute schemas must remain bounded and integer-only for numeric fields in protocol v1.
- Dependency installation or policy blocking is reported; no silent alternate serializer is allowed.
- This ADR specifies a design dependency, not evidence that the package has been installed, reviewed, or tested.
