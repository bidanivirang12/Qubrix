\set ON_ERROR_STOP on

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

SELECT
    :'dev_database' ~ '^[a-z][a-z0-9_]*$'
    AND :'test_database' ~ '^[a-z][a-z0-9_]*_test$'
    AND :'dev_database' <> :'test_database' AS database_names_valid
\gset

\if :database_names_valid
\else
\echo 'Invalid database names: dev must be a simple identifier and test must end in _test.'
\quit 3
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
SELECT format('GRANT CONNECT ON DATABASE %I TO qubrix_runtime', :'dev_database')
\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO qubrix_runtime', :'test_database')
\gexec

\connect :dev_database
GRANT USAGE ON SCHEMA public TO qubrix_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO qubrix_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO qubrix_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE qubrix_app IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO qubrix_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE qubrix_app IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO qubrix_runtime;

\connect :test_database
GRANT USAGE ON SCHEMA public TO qubrix_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO qubrix_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO qubrix_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE qubrix_app IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO qubrix_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE qubrix_app IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO qubrix_runtime;
