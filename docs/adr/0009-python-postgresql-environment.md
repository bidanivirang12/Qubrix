# ADR-0009: Python and PostgreSQL environment

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Qubrix targets Python 3.12 and PostgreSQL. The Windows development host has an Application Control policy and Docker is unavailable locally. Phase 0 recorded PostgreSQL as unavailable; the Phase 2 re-probe verified the local databases and distinct owner/runtime roles.

## Decision

Use Python 3.12 installed/selected through uv; record interpreter constraints in the project and lock dependencies with uv. Configure migrations with owner-role `DATABASE_URL` and `TEST_DATABASE_URL` values, and application access with restricted-role `RUNTIME_DATABASE_URL`; the audit permission test uses restricted-role `RUNTIME_TEST_DATABASE_URL`. All URLs are supplied through the environment and their values are never printed. Tests and Alembic migrations in the foundation phase refuse database names that do not end in `_test`. PostgreSQL is the target database and is not bundled or assumed to be available. Ruff and pyright are uv development dependencies. On Windows, run the ASGI server with the project's Selector event-loop factory because Psycopg async connections do not support Proactor event loops; `python -m app` selects it, as does Uvicorn's `--loop app.core.asyncio_support:selector_loop_factory`. Do not work around Application Control blocks silently: report the blocked executable and use only approved alternatives. Add `.gitattributes` forcing LF line endings.

Dockerfile, compose, and container-scan verification are performed in CI; because Docker is not available locally, do not report those checks as locally verified.

## Consequences

- Phase 2 setup must verify that the selected uv interpreter is Python 3.12 and that PostgreSQL is available before database integration tests.
- Tests must use an explicitly configured test database and must not fall back to production `DATABASE_URL`.
- CI owns container build/scan evidence until a Docker-capable approved environment is available.
- Environment availability stated in the later Phase 0 addendum is recorded in `docs/initial-assessment.md`; this ADR does not claim to have independently probed the installation.
