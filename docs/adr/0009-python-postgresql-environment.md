# ADR-0009: Python and PostgreSQL environment

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Qubrix targets Python 3.12 and PostgreSQL. The Windows development host has an Application Control policy; Docker is unavailable locally, and PostgreSQL is planned for local installation before Phase 2.

## Decision

Use Python 3.12 installed/selected through uv; record interpreter constraints in the project and lock dependencies with uv. Configure database access only via `DATABASE_URL` and tests via `TEST_DATABASE_URL`, supplied through the environment. Never print their values. PostgreSQL is the target database and is not bundled or assumed to be available. Ruff and pyright are uv development dependencies. Do not work around Application Control blocks silently: report the blocked executable and use only approved alternatives. Add `.gitattributes` forcing LF line endings.

Dockerfile, compose, and container-scan verification are performed in CI; because Docker is not available locally, do not report those checks as locally verified.

## Consequences

- Phase 2 setup must verify that the selected uv interpreter is Python 3.12 and that PostgreSQL is available before database integration tests.
- Tests must use an explicitly configured test database and must not fall back to production `DATABASE_URL`.
- CI owns container build/scan evidence until a Docker-capable approved environment is available.
- Environment availability stated in the later Phase 0 addendum is recorded in `docs/initial-assessment.md`; this ADR does not claim to have independently probed the installation.
