# ADR-0001: Adopt the supplied platform and security constraints

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Qubrix is a multi-tenant fintech security platform with TrustShield AI risk scoring and EncryptPlus cryptographic verification, encryption, inventory, and CBOM capabilities. The product requirements prescribe the runtime, framework, persistence, authentication model, processing model, and security invariants.

## Decision

Use the user-specified stack: Python 3.12, uv with a lockfile, FastAPI, Pydantic v2, SQLAlchemy 2 async, psycopg 3, Alembic, PostgreSQL, pytest, HTTPX, Ruff, pyright, Docker, and GitHub Actions. Keep the system a synchronous modular monolith; use OIDC JWT verification via JWKS without local passwords; do not use a broker or an LLM in v1.

Treat tenant, actor, and roles as authenticated-identity data, not request-body input. A valid signature does not establish transaction legitimacy and must never reduce risk. Failed or unavailable verification creates its own security finding, and verification status is a recorded risk input. Do not store secret keys in code, the database, logs, or responses; do not silently downgrade algorithms; fail closed; use established cryptographic libraries rather than implementing primitives; and do not store full card numbers or plaintext sensitive payloads.

## Consequences

- Implementation and tests must preserve these constraints across API, persistence, and risk-scoring boundaries.
- Local validation requires Python 3.12 and an available PostgreSQL service. The initial interpreter probe did not find Python 3.12; a subsequent environment addendum says it was installed via uv. PostgreSQL is planned for local installation before Phase 2.
- Any future design choice not settled by these constraints should be recorded in a subsequent numbered ADR.
