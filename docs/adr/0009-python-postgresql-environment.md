# ADR-0009: Python and PostgreSQL environment

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Qubrix targets Python 3.12 and PostgreSQL. The Windows development host has an Application Control policy and Docker is unavailable locally. Phase 0 recorded PostgreSQL as unavailable; the Phase 2 re-probe verified the local databases and distinct owner/runtime roles.

## Decision

Use Python 3.12 installed/selected through uv; record interpreter constraints in the project and lock dependencies with uv. Configure migrations with owner-role `TEST_DATABASE_URL` only; Alembic requires this value and verifies the connected database name before migrating. Destructive/test URLs must target a lowercase `qubrix_test` or `qubrix_<name>_test` database on localhost, `127.0.0.1`, or `::1`. Query parameters are rejected except `sslmode`; `sslmode` cannot alter the database or host, while parameters such as `dbname`, `host`, `hostaddr`, `service`, `options`, and `passfile` could redirect or alter the connection target. The hostname `postgres` is allowed only when `QUBRIX_ALLOW_NONLOCAL_TEST_DATABASE_HOST=true` is explicitly set for CI/Compose; this opt-in is forbidden in production. Test fixtures verify `current_database()` after connecting.

Application access uses restricted-role `RUNTIME_DATABASE_URL`; the audit permission test uses restricted-role `RUNTIME_TEST_DATABASE_URL`. `DATABASE_URL` is for explicitly scoped development tooling only and is never an application runtime fallback. These four unprefixed database URL names are canonical; do not also configure `QUBRIX_DATABASE_URL`, `QUBRIX_TEST_DATABASE_URL`, `QUBRIX_RUNTIME_DATABASE_URL`, or `QUBRIX_RUNTIME_TEST_DATABASE_URL`. All URLs are supplied through the environment and their values are never printed. Other application settings use the `QUBRIX_` prefix. Production ignores `.env` and requires deployment-injected configuration. PostgreSQL is the target database and is not bundled or assumed to be available. Ruff and pyright are uv development dependencies. On Windows, run the ASGI server with the project's Selector event-loop factory because Psycopg async connections do not support Proactor event loops; `python -m app` selects it, as does Uvicorn's `--loop app.core.asyncio_support:selector_loop_factory`. Do not work around Application Control blocks silently: report the blocked executable and use only approved alternatives. Add `.gitattributes` forcing LF line endings.

Use the checked-in `scripts/bootstrap_db.sql` for role and database setup in local development and CI. It is idempotent for existing roles and databases, refuses a test database name that does not end in `_test`, revokes database privileges from PUBLIC, and only grants CONNECT and schema USAGE. It never grants table/sequence privileges or configures default privileges. Each Alembic migration grants `qubrix_runtime` only the explicitly required privileges on objects it creates; the integration test checks every public table against a closed allowlist. CI generates ephemeral credentials and exposes each database URL only to the migration, integration-test, or container-smoke steps that need it. The CI migration step supplies only `TEST_DATABASE_URL`.

`QUBRIX_APP_SECRET` is reserved for the HMAC-SHA-256 signing key used by the planned pagination-cursor signer. It is not a JWT signing key, database password, encryption key, or substitute for the KMS/HSM. Rotate it by provisioning a new random secret in the deployment secret store and rolling out all replicas together; signed cursors created with the previous value become invalid and clients must restart pagination. Never print the value. The `.env.example` value is a placeholder and is rejected in production.

Dockerfile, compose, and container-scan verification are performed in CI; because Docker is not available locally, do not report those checks as locally verified.

## Consequences

- Phase 2 setup must verify that the selected uv interpreter is Python 3.12 and that PostgreSQL is available before database integration tests.
- Tests and migrations must use explicitly configured test database URLs and must not fall back to `DATABASE_URL`.
- CI owns container build/scan evidence until a Docker-capable approved environment is available.
- Environment availability stated in the later Phase 0 addendum is recorded in `docs/initial-assessment.md`; this ADR does not claim to have independently probed the installation.
