# Initial Assessment  -  Phase 0

**Assessment date:** 2026-10-12
**Working directory:** `C:\Users\Bidan\Desktop\Qubrix\Qubrix`

## Verified baseline

- The working directory was empty apart from the `.git` directory before this assessment. There were no tracked or untracked project files, source files, dependency manifests, tests, or documentation.
- Git is initialized (`git version 2.55.0.windows.3`) on branch `main`. There are no commits; `git log` reports that the branch has no commits. Git status reports `No commits yet on main...origin/main [gone]`.
- At the time of the Phase 0 command probes, Python on `PATH` was 3.13.15. `py -0p` and `uv python list --only-installed` did not list Python 3.12. uv also reported an Application Control policy blocking inspection of `C:\Users\Bidan\.local\bin\python3.14.exe`. A subsequent environment addendum from the user states that Python 3.12 has been installed via uv; that installation was not independently re-probed in this phase.
- uv is available at version 0.12.13.
- Docker, `psql`, and `pg_isready` are not available as commands. A TCP probe to `127.0.0.1:5432` failed; no local PostgreSQL endpoint was reachable at that address and port during the probe.
- pytest 9.1.1 is available. Ruff and pyright are not available as commands.
- No test files or test configuration were present, so the baseline test result is **N/A  -  no tests exist**.
- Network access was not tested. No environment variable values were inspected or printed.

## Repository disposition

There is no existing application code or project configuration to preserve or migrate. Git already exists, so it was not initialized again. This phase adds only documentation and a `.gitignore`; no application code was written.

## Assumptions and decisions

- The fixed stack and security requirements supplied for Qubrix are authoritative. This assessment does not choose additional application architecture.
- Development and CI must use Python 3.12. The initial Phase 0 probe did not find it; the subsequent environment addendum states it has since been installed via uv.
- PostgreSQL/Docker-dependent validation will require an available service or an explicitly configured CI service. No credentials or connection configuration were present to assess.
- Security-sensitive behavior (identity-derived tenant/actor/roles, fail-closed verification, independent findings on failed/unavailable verification, and no signature-based risk reduction) must be covered by tests as those features are implemented.

## Short implementation plan

1. Prepare Python 3.12 and the project tooling; establish the uv project and lockfile for the specified stack.
2. Add only the first tested application modules and their focused tests, preserving the specified tenant identity and cryptographic verification invariants.
3. Add database models and Alembic migrations, then exercise them against PostgreSQL.
4. Add OIDC/JWKS resource-server integration with tests that do not depend on production credentials or secrets.
5. Add Docker and GitHub Actions workflows for reproducible checks; run pytest, Ruff, and pyright in CI and document architectural decisions in numbered ADRs.

## Risks and limitations

- **Medium  -  interpreter verification:** The initial Phase 0 probe did not find Python 3.12; a later user-provided addendum says it was installed via uv. Its current availability was not independently checked during this assessment.
- **High  -  no local database/container tooling:** Docker and PostgreSQL client tools are absent, and localhost port 5432 is unreachable. Database migrations and integration tests cannot yet be verified locally.
- **Medium  -  no baseline code or tests:** There is no behavioral baseline; regression coverage must be introduced alongside implementation.
- **Medium  -  clean history not established:** The repository has no commits and its branch reports a missing `origin/main` upstream. Branch/remote setup should be confirmed before relying on GitHub workflows.
- **Unassessed  -  network and external services:** Network availability and OIDC/JWKS provider behavior were not tested.

## Commands and baseline results

| Command/probe | Result |
|---|---|
| `Get-Location`; root `Get-ChildItem -Force` | Confirmed the Qubrix working directory; only `.git` existed. |
| `git status --short --branch` | `## No commits yet on main...origin/main [gone]`. |
| `git log -5 --oneline --decorate` | No commits; Git reported that `main` has no commits. |
| `git ls-files` | No tracked files. |
| Recursive project/test/config inventory | No project files, tests, manifests, or docs found. |
| `git --version` | `git version 2.55.0.windows.3`. |
| `python --version`; `uv --version` | Python `3.13.15`; uv `0.12.13`. |
| `py -0p`; `uv python list --only-installed` | Python 3.13 and 3.14 available; Python 3.12 not listed. uv also reported an Application Control policy blocking one Python 3.14 path. |
| Tool availability/version probes | Docker, `psql`, `pg_isready`, Ruff, and pyright unavailable; pytest `9.1.1`. |
| `Test-NetConnection 127.0.0.1 -Port 5432` | `TcpTestSucceeded: False`. |
| Baseline tests | N/A: no test files or test configuration exist. |

## Subsequent environment addendum

The user later supplied an environment update stating that Python 3.12 was installed via uv. PostgreSQL remains not installed and is planned before Phase 2, with `DATABASE_URL` and `TEST_DATABASE_URL` supplied through the environment. Docker is unavailable locally; Dockerfile, compose, and container-scan checks must remain unverified until CI runs them. Ruff and pyright are to be project uv development dependencies rather than global tools. An Application Control policy exists; blocked executables must be reported, not silently worked around. This addendum records supplied information, not a new command result.
