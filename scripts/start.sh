#!/usr/bin/env bash
# Container entrypoint.
#  1. If the volume is empty and a replica exists, restore the database from it.
#  2. Run the app under Litestream so every write is replicated.
# Migrations run inside the app on start (src/hooks.server.ts).
set -euo pipefail

DB="${DATABASE_URL:-/data/library.db}"

if [ -n "${LITESTREAM_REPLICA_URL:-}" ]; then
  if [ ! -f "$DB" ]; then
    echo "No database on the volume, trying to restore from replica..."
    litestream restore -if-replica-exists -config /etc/litestream.yml "$DB" || true
  fi
  exec litestream replicate -config /etc/litestream.yml -exec "node build"
else
  echo "LITESTREAM_REPLICA_URL not set: running without backups."
  exec node build
fi
