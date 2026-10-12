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
`_test`. It does not drop or reset databases. Re-run it after a successful run
to reconcile role attributes and runtime grants.

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

For Compose, set `POSTGRES_PASSWORD`, `OWNER_DB_PASSWORD`, and
`RUNTIME_DB_PASSWORD` in the environment before running `docker compose up`.
The PostgreSQL initialization wrapper invokes the same
[`bootstrap_db.sql`](../scripts/bootstrap_db.sql) script used in CI.
