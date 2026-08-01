#!/usr/bin/env bash
set -euo pipefail

umask 077

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
database_path="${PTB_DATABASE_PATH:-$project_root/backend/instance/app.db}"
backup_dir="${PTB_BACKUP_DIR:-$(dirname "$project_root")/backups/predict-the-ball}"
remote="${PTB_BACKUP_REMOTE:-gdrive:predict-the-ball-db-backups}"

if [[ ! -f "$database_path" ]]; then
    echo "Database not found: $database_path" >&2
    exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "sqlite3 is required" >&2
    exit 1
fi

if ! command -v rclone >/dev/null 2>&1; then
    echo "rclone is required" >&2
    exit 1
fi

mkdir -p "$backup_dir"
stamp="$(date +%F)"
backup_db="$backup_dir/predict-the-ball-$stamp.sqlite"
backup_gz="$backup_db.gz"

sqlite3 "$database_path" ".backup '$backup_db'"

if [[ "$(sqlite3 "$backup_db" 'PRAGMA integrity_check;')" != "ok" ]]; then
    echo "Backup integrity check failed: $backup_db" >&2
    exit 1
fi

gzip -f "$backup_db"

rclone copyto "$backup_gz" "$remote/$(basename "$backup_gz")"

find "$backup_dir" \
    -type f \
    -name 'predict-the-ball-*.sqlite.gz' \
    -mtime +6 \
    -delete

rclone delete "$remote" \
    --include 'predict-the-ball-*.sqlite.gz' \
    --min-age 7d \
    --drive-use-trash=false

echo "Created $backup_gz and copied it to $remote"
