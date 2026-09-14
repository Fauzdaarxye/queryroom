#!/usr/bin/env bash
# Run on the EC2 host: sudo bash scripts/backup-progress.sh
set -euo pipefail
umask 077

project_directory=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$project_directory"
backup_directory=${1:-/var/backups/queryroom}
mkdir -p -- "$backup_directory"
temporary_file=$(mktemp "$backup_directory/.progress.XXXXXX")
trap 'rm -f -- "$temporary_file"' EXIT

compose=(docker compose -f compose.yaml)
"${compose[@]}" exec -T postgres sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --schema=queryroom_state' > "$temporary_file"
# Check the archive before presenting it as a completed backup.
"${compose[@]}" exec -T postgres pg_restore --list < "$temporary_file" > /dev/null

backup_file="$backup_directory/progress-$(date -u +%Y%m%dT%H%M%SZ)-${temporary_file##*.}.dump"
mv -- "$temporary_file" "$backup_file"
printf 'Backup saved: %s\n' "$backup_file"
