#!/bin/sh
set -eu

if [ "$#" -ne 1 ] || [ ! -s "$1" ]; then
  echo "Usage: ops/restore-verify.sh backups/fendor-TIMESTAMP.dump" >&2
  exit 2
fi

temporary_db="fendor_restore_check_$(date -u +%Y%m%d%H%M%S)_$$"
case "$temporary_db" in
  fendor_restore_check_*) ;;
  *) echo "Unsafe temporary database name" >&2; exit 2 ;;
esac

compose="docker compose --env-file .env.staging -f compose.staging.yaml"
cleanup() {
  $compose exec -T db dropdb --if-exists --force --username=fendor "$temporary_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

$compose exec -T db createdb --username=fendor "$temporary_db"
$compose exec -T db pg_restore --exit-on-error --no-owner --no-acl --username=fendor --dbname="$temporary_db" < "$1"
$compose exec -T db psql --username=fendor --dbname="$temporary_db" --tuples-only --command \
  "SELECT count(*) FROM schema_migrations; SELECT count(*) FROM users; SELECT count(*) FROM order_requests;"

echo "Restore verification passed in temporary database $temporary_db"
