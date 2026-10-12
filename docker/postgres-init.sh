#!/bin/sh
set -eu

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set ON_ERROR_STOP=1 \
  --set runtime_password="$RUNTIME_DB_PASSWORD" \
  --file /docker/01-create-runtime.sql
