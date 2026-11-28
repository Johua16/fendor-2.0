#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ] || [ -z "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  echo "DATABASE_URL and BACKUP_ENCRYPTION_PASSPHRASE are required." >&2
  exit 2
fi
case "$DATABASE_URL" in
  *sslmode=verify-full*) ;;
  *) echo "DATABASE_URL must require certificate and hostname verification with sslmode=verify-full." >&2; exit 2 ;;
esac

for command in pg_dump pg_restore openssl awk; do
  command -v "$command" >/dev/null 2>&1 || { echo "$command is required." >&2; exit 2; }
done
sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}';
  else shasum -a 256 "$1" | awk '{print $1}'; fi
}

umask 077
log() { printf 'portable-backup: %s\n' "$1" >&2; }
backup_dir="${BACKUP_DIR:-./backups/portable}"
mkdir -p "$backup_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
temporary="$(mktemp -d "${TMPDIR:-/tmp}/fendora-portable-backup.XXXXXX")"
cleanup() { rm -f "$temporary/archive.dump" "$temporary/raw.sql" "$temporary/portable.sql"; rmdir "$temporary" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

log "creating application archive"
pg_dump "$DATABASE_URL" --format=custom --schema=public --no-owner --no-acl --file="$temporary/archive.dump"
test -s "$temporary/archive.dump"
log "converting archive to portable SQL"
pg_restore --no-owner --no-acl --file="$temporary/raw.sql" "$temporary/archive.dump"

# Supabase emits a provider-specific pg_attver attribute that stock PostgreSQL
# rejects. It is metadata, not application schema or data.
awk '!/ SET \(pg_attver=/' "$temporary/raw.sql" > "$temporary/portable.sql"
if grep -q 'pg_attver' "$temporary/portable.sql"; then
  echo "Provider-specific pg_attver metadata remains after conversion." >&2
  exit 1
fi

plain_sha="$(sha256_file "$temporary/portable.sql")"
target="$backup_dir/fendora-$stamp.sql.enc"
manifest="$target.manifest"
log "encrypting portable backup"
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -in "$temporary/portable.sql" -out "$target" -pass env:BACKUP_ENCRYPTION_PASSPHRASE
encrypted_sha="$(sha256_file "$target")"

{
  echo "format=fendora-portable-sql-v1"
  echo "created_utc=$stamp"
  echo "plaintext_sha256=$plain_sha"
  echo "encrypted_sha256=$encrypted_sha"
} > "$manifest"
chmod 600 "$target" "$manifest"
log "backup and manifest complete"
echo "$target"
