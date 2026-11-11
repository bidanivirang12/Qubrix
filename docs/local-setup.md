# Local PostgreSQL setup

The application connects as the restricted `qubrix_runtime` role. Use `qubrix_app`
only for migrations and database ownership. Do not use either owner URL for
application runtime traffic.

## Bootstrap with local PostgreSQL

Run this in PowerShell from the repository root, substituting a local PostgreSQL
superuser if it is not named `postgres`:

```powershell
psql -W -h localhost -U postgres -d postgres `
  --set dev_database=qubrix_dev `
  --set test_database=qubrix_test `
  --file scripts/bootstrap_db.sql
```

The script silently prompts for a password if either Qubrix role does not exist.
It does not request or rotate a password for an existing role. It creates
databases only when absent and refuses a test database name that does not end in
`_test`. It does not drop or reset databases. Re-running it reapplies role
attributes, database ownership, database PUBLIC revocation, CONNECT grants, and
runtime schema USAGE only.
It never grants table or sequence privileges or configures default privileges.
Alembic migrations grant runtime privileges individually on each table they
create; each future table must be added to the explicit privilege allowlist
integration test as well.

The current database privilege allowlist is: `organizations` gets `SELECT`,
`INSERT`, and `UPDATE` so the service can read, provision, and change lifecycle
state; `DELETE` is excluded because tenant removal is a soft-delete and audit
records must retain their organization reference. `audit_records` gets only
`SELECT` and `INSERT`. `alembic_version` gets no runtime privileges. The
foundation migration creates no sequences; future migrations must grant only
the necessary sequence privileges explicitly and add those objects to tests.

The canonical database URL environment variables are `DATABASE_URL` and
`TEST_DATABASE_URL` for the `qubrix_app` owner, and `RUNTIME_DATABASE_URL` and
`RUNTIME_TEST_DATABASE_URL` for `qubrix_runtime`. Do not use their former
`QUBRIX_`-prefixed variants. Keep values in the ignored `.env` file or another
secret store; do not put credentials in source control or command history. Use
URL-safe passwords or percent-encode reserved characters in connection URLs.
Other settings use the `QUBRIX_` prefix.

`QUBRIX_APP_SECRET` is intended for HMAC-SHA-256 pagination-cursor signing; it
is not a JWT or encryption key. Rotate it through the deployment secret store
and roll out all replicas together; existing signed cursors will become invalid.
Never print the secret. Production requires a strong, non-placeholder value and
does not read `.env`.

Destructive and test connections accept only lowercase `qubrix_test` or
`qubrix_<name>_test` database names and local hosts (`localhost`, `127.0.0.1`,
or `::1`).
The only accepted URL query option is `sslmode`; target-changing libpq options
such as `dbname`, `host`, `hostaddr`, `service`, `options`, and `passfile` are
rejected. The CI/Compose-only PostgreSQL service hostname `postgres` requires
the explicit `QUBRIX_ALLOW_NONLOCAL_TEST_DATABASE_HOST=true` opt-in. Do not set
that opt-in in production. Alembic and the test-session fixture verify
`current_database()` after connecting before doing migration or fixture work.

## Local Docker Compose stack

The Compose stack is for local development, not production. Create `.env` from
`.env.example`, then generate unique values for `POSTGRES_PASSWORD`,
`OWNER_DB_PASSWORD`, `RUNTIME_DB_PASSWORD`, and `QUBRIX_APP_SECRET`. Do not
commit `.env` or reuse these credentials elsewhere.

Run `docker compose config --quiet` to validate interpolation without printing
resolved environment values, then `docker compose up --build -d`. The
PostgreSQL initialization wrapper invokes the same
[`bootstrap_db.sql`](../scripts/bootstrap_db.sql) script used in CI. The
migration job intentionally targets `qubrix_test`: Alembic and the test harness
reject migrations against non-test databases. The local backend uses the
restricted runtime role on that migrated database; do not carry this test
database arrangement into production.

The frontend is served by Nginx on `http://localhost:8080`. It proxies `/api/`
and `/health/` to the backend over Compose's private network. The backend is
also available on `http://localhost:8000`, and PostgreSQL on
`localhost:5433`; both host bindings are loopback-only. PostgreSQL data is kept
in the named `qubrix-postgres` volume. Stopping containers does not remove that
volume; the init scripts run only when PostgreSQL first initializes an empty
data directory.
