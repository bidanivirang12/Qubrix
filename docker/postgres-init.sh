#!/bin/sh
set -eu

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set ON_ERROR_STOP=1 \
  --set owner_password="$OWNER_DB_PASSWORD" \
  --set runtime_password="$RUNTIME_DB_PASSWORD" \
  --set dev_database=qubrix_dev \
  --set test_database=qubrix_test \
  --file /docker/bootstrap_db.sql
