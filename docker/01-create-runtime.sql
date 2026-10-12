CREATE ROLE qubrix_runtime
    LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOINHERIT
    PASSWORD :'runtime_password';

CREATE DATABASE qubrix_test OWNER qubrix_app;
GRANT CONNECT ON DATABASE qubrix_dev TO qubrix_runtime;
GRANT CONNECT ON DATABASE qubrix_test TO qubrix_runtime;

\connect qubrix_dev
GRANT USAGE ON SCHEMA public TO qubrix_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE qubrix_app IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO qubrix_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE qubrix_app IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO qubrix_runtime;

\connect qubrix_test
GRANT USAGE ON SCHEMA public TO qubrix_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE qubrix_app IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO qubrix_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE qubrix_app IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO qubrix_runtime;
