#!/usr/bin/env bash
# Runs every migration (twice, to prove they're safe to re-run) and the tests in this
# folder against a fresh Postgres database. Used by CI; also works locally:
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres bash supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")"
DB="${PGDATABASE:-grassroots_test}"
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"

run() { echo "== $1"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }

run 00_supabase_stub.sql
run 01_app_tables.sql
for pass in 1 2; do
  for m in ../migrations/*.sql; do run "$m"; done
done
for t in [1-9]*_*.sql; do run "$t"; done
echo "All database tests passed."
