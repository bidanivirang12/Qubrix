\set ON_ERROR_STOP on

SELECT set_config(
    'qubrix.bootstrap.dev_database',
    :'dev_database',
    false
);
SELECT set_config(
    'qubrix.bootstrap.test_database',
    :'test_database',
    false
);

DO $$
DECLARE
    dev_database text := current_setting('qubrix.bootstrap.dev_database');
    test_database text := current_setting('qubrix.bootstrap.test_database');
BEGIN
    IF dev_database !~ '^[a-z][a-z0-9_]*$'
       OR test_database !~ '^[a-z][a-z0-9_]*_test$'
       OR dev_database = test_database THEN
        RAISE EXCEPTION
            'Invalid database names: dev must be a simple identifier and test must end in _test';
    END IF;
END;
$$;

\if :{?owner_password}
\else
SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qubrix_app') AS owner_role_exists
\gset
\if :owner_role_exists
\set owner_password existing-role-password-not-used
\else
\prompt -s 'Password for a new qubrix_app role: ' owner_password
\endif
\endif

\if :{?runtime_password}
\else
SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qubrix_runtime') AS runtime_role_exists
\gset
\if :runtime_role_exists
\set runtime_password existing-role-password-not-used
\else
\prompt -s 'Password for a new qubrix_runtime role: ' runtime_password
\endif
\endif

SELECT format(
    'CREATE ROLE qubrix_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',
    :'owner_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qubrix_app')
\gexec

SELECT format(
    'CREATE ROLE qubrix_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD %L',
    :'runtime_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qubrix_runtime')
\gexec

-- ALTER ROLE and ALTER DATABASE ... OWNER intentionally reconcile state on every execution.
ALTER ROLE qubrix_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE qubrix_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

SELECT format('CREATE DATABASE %I OWNER qubrix_app', :'dev_database')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'dev_database')
\gexec

SELECT format('CREATE DATABASE %I OWNER qubrix_app', :'test_database')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'test_database')
\gexec

SELECT format('ALTER DATABASE %I OWNER TO qubrix_app', :'dev_database')
\gexec
SELECT format('ALTER DATABASE %I OWNER TO qubrix_app', :'test_database')
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM PUBLIC', :'dev_database')
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM PUBLIC', :'test_database')
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM qubrix_runtime', :'dev_database')
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM qubrix_runtime', :'test_database')
\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO qubrix_app', :'dev_database')
\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO qubrix_app', :'test_database')
\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO qubrix_runtime', :'dev_database')
\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO qubrix_runtime', :'test_database')
\gexec

\connect :dev_database
GRANT USAGE ON SCHEMA public TO qubrix_runtime;

\connect :test_database
GRANT USAGE ON SCHEMA public TO qubrix_runtime;
