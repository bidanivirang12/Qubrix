# Initial Assessment — Phase 0 snapshot

**Snapshot date:** 2026-10-12
**Repository location:** local Qubrix repository root on Windows; absolute workstation path intentionally omitted.

This file preserves the discovery snapshot taken in Phase 0 and appends a later environment re-probe. Phase 0 facts below describe what was true at that time, not the current repository state. Current design decisions are documented in [architecture.md](./architecture.md) and the [ADRs](./adr/).

## Phase 0 snapshot

- The working directory was empty apart from Git metadata. There were no source files, dependency manifests, tests, or project documentation.
- Git was initialized on branch `main` with no commits. At that time, `git status` reported `No commits yet on main...origin/main [gone]`; both statements are historical Phase 0 facts.
- Python on `PATH` was 3.13.15. The initial interpreter listing did not show Python 3.12. uv was 0.12.13.
- Docker, `psql`, and `pg_isready` were not available as commands. The initial TCP probe to `127.0.0.1:5432` failed.
- pytest 9.1.1 was available; Ruff and pyright were not global commands.
- No tests or test configuration existed. Baseline result: **N/A — no tests exist**.
- Environment-variable values were not inspected or printed.

## Re-probe results

Re-probed on 2026-10-12 using PowerShell. Values of Git user configuration and database environment variables were not printed.

| Probe | Actual result |
|---|---|
| `uv run --offline --python 3.12 python --version` | `Python 3.12.14`; exit code 0. |
| `uv python list --only-installed` | Python 3.12.14, 3.13.15, and 3.14.7 entries were listed. uv also warned that Application Control blocked inspection of a separate Python 3.14 executable (OS error 4551); Python 3.12 itself ran successfully. |
| `git remote -v` | Fetch and push are both configured as `origin https://github.com/<repository-owner>/Qubrix.git`; the owner is redacted here to omit a username. |
| `git config --get core.autocrlf` | `true` (system-level configuration). |
| `git config --get user.name` / `git config --get user.email` | `user.name set: True`; `user.email set: True`. Values intentionally not displayed. |
| `$PSVersionTable.PSVersion`; `$PSVersionTable.PSEdition` | PowerShell `5.1.26100.9444`, edition `Desktop`. `$PSVersionTable.OS` was empty. |
| `Get-CimInstance Win32_OperatingSystem` | `Microsoft Windows 11 Home`, version `10.0.26300`, build `26300`. |
| `Get-ExecutionPolicy -List` | `CurrentUser: RemoteSigned`; `MachinePolicy`, `UserPolicy`, `Process`, and `LocalMachine`: `Undefined`. |
| `node --version` | Node.js available; `v24.19.0`. |
| `Test-NetConnection pypi.org -Port 443` | `TcpTestSucceeded: True`; selected remote address `2a04:4e42::223` (IPv6). This establishes TCP reachability only, not package installation or broader network availability. |
| PostgreSQL local/environment probe | `Test-NetConnection 127.0.0.1 -Port 5432`: `TcpTestSucceeded: False`; `DATABASE_URL is set: False`; `TEST_DATABASE_URL is set: False`. No environment-variable values were read. |
| Current Git state | Branch `main`; local branch is ahead of its `origin/main` tracking ref by 2 commits. Last observed local-tracking `origin/main` commit was `9bbb256`. The working tree was clean before editing this snapshot. No live remote fetch was performed. |
| Foundation files | `pyproject.toml`, `uv.lock`, `alembic.ini`, and `tests/` were absent at re-probe time. |

## Current repository disposition

Phase 0 added `.gitignore` and the initial assessment/ADR, then the Phase 0 files were committed. Phase 1 design documents and subsequent threat-model revisions have also been committed. The repository now contains design documentation but no application source, dependency project/lockfile, migrations, or test suite. The Phase 0 statement that there were no commits and `origin/main` was gone was true at the time of that original snapshot; it is no longer the current Git state.

## Current phase sequence and dependencies

| Phase | Work | Dependency or blocker |
|---|---|---|
| 1 — Design | Document architecture, trust boundaries, API contracts, data model, threat model, controls, and ADRs. | **Verified complete:** design files are present and committed; documentation consistency checks have been run. |
| 2 — Foundation | Establish the Python 3.12 uv project/lockfile, FastAPI application skeleton, PostgreSQL configuration, Alembic baseline, and test setup. | **Blocked:** PostgreSQL is not reachable at the local probe address, and neither `DATABASE_URL` nor `TEST_DATABASE_URL` is set. Do not start database foundation/integration work until PostgreSQL is reachable through both `DATABASE_URL` and `TEST_DATABASE_URL`. Python 3.12.14 via uv is verified; project manifests and tests are still absent. |
| 3 — Identity and tenancy | Implement OIDC/JWKS validation, identity context, scopes/roles, and tenant-scoped persistence/authorization. | Depends on Phase 2 application/database foundation and configured trusted issuer/tenant mapping; neither implementation nor issuer configuration is present yet. |
| 4 — Event ingestion and TrustShield | Implement typed bounded event schemas, idempotency/replay, risk features, assessments, findings, and analyst review. | Depends on Phase 2 persistence and Phase 3 authenticated tenant context; no application modules or tests exist yet. |
| 5 — EncryptPlus | Implement canonical signed-event verification, key-provider boundary, crypto endpoints, key lifecycle, inventory, and CBOM. | Depends on Phases 2–4 and an approved provider configuration/test strategy. A production KMS/HSM provider has not been selected or configured. |
| 6 — Operational hardening | Implement audit/retention, rate limiting, logging/redaction, CI checks, and container build/scan workflows. | Depends on tested application behavior from Phases 2–5. Docker is unavailable locally; Dockerfile/compose/container-scan results remain unverified until CI executes them. |
| 7 — Release readiness | Run release tests, migration/restore checks, security review, configuration review, and verify CI/container evidence. | Depends on Phases 2–6, reachable production-like PostgreSQL/test databases, approved OIDC and key providers, configured secrets, and successful CI. Release evidence does not yet exist. |

## Assumptions and current decisions

- The fixed stack and security requirements supplied for Qubrix are authoritative.
- Tenancy, actor, roles, scopes, signature semantics, risk rules, and key-provider boundaries are recorded in the current design docs and ADRs; this snapshot does not replace them.
- Development/test database access must use `DATABASE_URL` and `TEST_DATABASE_URL`; their values must not be printed. Tests must not silently fall back to a production database.
- Security-sensitive invariants must have tests as they are implemented. A documented test plan is not evidence that a control has passed.

## Risks and limitations

- **High — PostgreSQL gate:** Local PostgreSQL is unreachable at `127.0.0.1:5432`, and neither required database URL variable is set. Phase 2 is blocked until PostgreSQL is reachable through both variables.
- **High — Application Control:** uv reported that Application Control blocked inspection of a Python 3.14 executable. Python 3.12.14 itself ran successfully via uv offline. If an approved uv-installed tool is blocked, stop and report the block rather than bypassing the policy. Named possible type-checker fallback: mypy instead of pyright; use it only if needed and record the choice in an ADR before adoption.
- **Medium — Windows tooling hazards:** System Git has `core.autocrlf=true`; `.gitattributes` specifies LF. Continue checking actual staged line endings. Windows path-length limits and PowerShell quoting/escaping can also break deep paths or commands; use bounded paths and carefully quoted PowerShell-compatible invocations.
- **High — secrets in environment variables:** `DATABASE_URL`, `TEST_DATABASE_URL`, provider credentials, and other secret configuration must not be printed, copied into documentation, source, logs, crash reports, or command output. Presence checks must not reveal values. Prefer the approved secret-injection mechanism and restrict process access.
- **Medium — remote and CI readiness:** `origin` and a local `origin/main` tracking ref exist, but no live fetch/push or CI run was performed in this re-probe. Docker is unavailable locally; Dockerfile, compose, and container-scan items remain unverified until the remote workflow runs successfully.
- **Medium — no implementation/test baseline:** Foundation manifests, migrations, application code, and tests were absent at re-probe time; there is no executable behavior or regression baseline.
- **Medium — network scope:** TCP to `pypi.org:443` succeeded over IPv6; TLS/package download, other endpoints, and OIDC/KMS availability were not tested.

## Historical Phase 0 commands and baseline

| Command/probe | Phase 0 result |
|---|---|
| Root directory and recursive project/test inventory | Only `.git` existed; no project files, tests, manifests, or docs. |
| `git status --short --branch` | `## No commits yet on main...origin/main [gone]`. |
| `git log -5 --oneline --decorate` | No commits; Git reported that `main` had no commits. |
| `git ls-files` | No tracked files. |
| `python --version`; `uv --version` | Python `3.13.15`; uv `0.12.13`. |
| Tool availability/version probes | Docker, `psql`, `pg_isready`, Ruff, and pyright unavailable; pytest `9.1.1`. |
| `Test-NetConnection 127.0.0.1 -Port 5432` | `TcpTestSucceeded: False`. |
| Baseline tests | N/A: no test files or test configuration existed. |

The historical plan from Phase 0 has been superseded by the current phase sequence above. See [architecture.md](./architecture.md) and the [numbered ADRs](./adr/) for current design decisions.
