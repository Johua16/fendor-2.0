#!/bin/sh
set -eu

umask 077
backup_dir="${BACKUP_DIR:-./backups}"
mkdir -p "$backup_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$backup_dir/fendor-$stamp.dump"

docker compose --env-file .env.staging -f compose.staging.yaml exec -T db \
  pg_dump --format=custom --no-owner --no-acl --username=fendor --dbname=fendor > "$target"

test -s "$target"
echo "$target"
