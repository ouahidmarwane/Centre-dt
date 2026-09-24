#!/usr/bin/env bash
# SQL integration tests. Each supabase/tests/*.test.sql file runs in one transaction
# that is always rolled back. Only a LOCAL database is accepted (supabase start).
#
#   npx supabase start            # local stack with every migration applied
#   npm run test:db
#
# Uses psql with SUPABASE_DB_URL when available, otherwise `docker exec` (or podman,
# via CONTAINER_ENGINE=podman) into the local supabase_db_* container.
set -euo pipefail

cd "$(dirname "$0")/.."
DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
case "$DB_URL" in
  *@127.0.0.1:*|*@localhost:*) ;;
  *) echo "Refusing to run integration tests against a non-local database." >&2; exit 1 ;;
esac

if command -v psql >/dev/null 2>&1; then
  run_sql() { psql "$DB_URL" -X -q -v ON_ERROR_STOP=1; }
else
  ENGINE="${CONTAINER_ENGINE:-docker}"
  CONTAINER="$("$ENGINE" ps --format '{{.Names}}' | grep -m1 '^supabase_db_' || true)"
  if [ -z "$CONTAINER" ]; then echo "No local supabase_db_* container found. Run: npx supabase start" >&2; exit 1; fi
  run_sql() { "$ENGINE" exec -i "$CONTAINER" psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1; }
fi

status=0
error_log="$(mktemp)"
trap 'rm -f "$error_log"' EXIT
for test_file in supabase/tests/*.test.sql; do
  if { echo "begin;"; cat supabase/tests/helpers.sql "$test_file"; echo "rollback;"; } | run_sql >/dev/null 2>"$error_log"; then
    echo "ok   $(basename "$test_file")"
  else
    echo "FAIL $(basename "$test_file")"; grep -m3 -E 'ERROR|ASSERTION' "$error_log" || cat "$error_log"
    status=1
  fi
done
exit "$status"
