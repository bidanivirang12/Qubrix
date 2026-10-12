# ADR-0002: Fixed application stack

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Qubrix requires a maintainable Python modular monolith and a reproducible environment across Windows development and CI.

## Decision

Use Python 3.12, uv and its committed lockfile, FastAPI, Pydantic v2, SQLAlchemy 2 async, psycopg 3, Alembic, PostgreSQL, pytest, HTTPX, Ruff, pyright, Docker, and GitHub Actions. Ruff and pyright are uv development dependencies, not prerequisites installed globally. No broker or LLM is used in v1.

## Consequences

- Pin and resolve dependencies with uv; verify tests and static checks in CI.
- Separate API, domain, persistence, provider, and policy modules within one deployable application.
- Docker and container scanning are CI verification items because Docker is unavailable locally.
- Details about identity, key handling, processing, rate limits, risk, and environment are recorded in ADR-0003 through ADR-0009.
