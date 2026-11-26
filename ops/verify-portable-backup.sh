#!/bin/sh
set -eu

if [ "$#" -ne 1 ] || [ ! -s "$1" ]; then
  echo "Usage: ops/verify-portable-backup.sh backups/fendora-TIMESTAMP.sql.enc" >&2
  exit 2
fi
if [ -z "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ] || [ -z "${RESTORE_DATABASE_URL:-}" ]; then
  echo "BACKUP_ENCRYPTION_PASSPHRASE and RESTORE_DATABASE_URL are required." >&2
  exit 2
fi
case "$RESTORE_DATABASE_URL" in
  *localhost*|*127.0.0.1*) ;;
  *) echo "Restore verification is restricted to a localhost PostgreSQL instance." >&2; exit 2 ;;
esac
if [ "${ALLOW_DESTRUCTIVE_RESTORE_VERIFY:-}" != "true" ]; then
  echo "Set ALLOW_DESTRUCTIVE_RESTORE_VERIFY=true for the isolated restore database." >&2
  exit 2
fi

manifest="$1.manifest"
test -s "$manifest" || { echo "Backup manifest is missing." >&2; exit 2; }
sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}';
  else shasum -a 256 "$1" | awk '{print $1}'; fi
}
umask 077
temporary="$(mktemp "${TMPDIR:-/tmp}/fendora-portable-restore.XXXXXX.sql")"
cleanup() { rm -f "$temporary"; }
trap cleanup EXIT INT TERM

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in "$1" -out "$temporary" -pass env:BACKUP_ENCRYPTION_PASSPHRASE
expected="$(awk -F= '$1=="plaintext_sha256" {print $2}' "$manifest")"
actual="$(sha256_file "$temporary")"
test -n "$expected" && test "$actual" = "$expected" || { echo "Backup checksum verification failed." >&2; exit 1; }

# The target must be an isolated, disposable localhost database. The workflow
# provisions it solely for this restore and discards it after the job.
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public CASCADE;'
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$temporary" >/dev/null
counts="$(psql "$RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atc \
  "SELECT count(*) FROM schema_migrations; SELECT count(*) FROM users; SELECT count(*) FROM order_requests; SELECT count(*) FROM payment_records;")"
migrations="$(printf '%s\n' "$counts" | sed -n '1p')"
test "${migrations:-0}" -ge 13 || { echo "Restore has fewer than 13 migrations." >&2; exit 1; }
printf 'Restore verification passed. migrations/users/orders/payments: %s\n' "$(printf '%s' "$counts" | tr '\n' '/')"
