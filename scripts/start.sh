#!/usr/bin/env bash
# Container entrypoint.
#  1. If the database is missing, restore it or require explicit first-run setup.
#  2. Run the app under Litestream so every write is replicated.
# Migrations run inside the app on start (src/hooks.server.ts).
set -euo pipefail

export DATABASE_URL="${DATABASE_URL:-/data/library.db}"
DB="$DATABASE_URL"
CONFIG="${LITESTREAM_CONFIG:-/etc/litestream.yml}"
export LITESTREAM_REGION="${LITESTREAM_REGION:-${AWS_REGION:-us-east-1}}"
RECOVERY="$(dirname "$0")/database-recovery.mjs"

if [ -e "$DB" ] || [ -L "$DB" ]; then
  node "$RECOVERY" check "$DB"
elif [ -e "$DB-wal" ] || [ -e "$DB-shm" ]; then
  echo "Database missing but SQLite sidecar files remain. Preserve them and recover manually." >&2
  exit 1
elif [ -n "${LITESTREAM_REPLICA_URL:-}" ]; then
  echo "Database missing: restoring from the Litestream replica..."
  node "$RECOVERY" restore "$DB" "$CONFIG"
else
  if [ "${DATABASE_INITIALIZE:-0}" != "1" ]; then
    echo "Database missing and no replica configured. Refusing to create an empty library." >&2
    echo "Restore a Fly volume snapshot, or set DATABASE_INITIALIZE=1 for intentional first-run setup." >&2
    exit 1
  fi
  echo "DATABASE_INITIALIZE=1: creating a new library. Remove this flag after setup."
fi

if [ -n "${LITESTREAM_REPLICA_URL:-}" ]; then
  exec litestream replicate -config "$CONFIG" -exec "node build"
else
  echo "No Litestream replica configured: continuous backups are disabled; rely on volume snapshots."
  exec node build
fi
