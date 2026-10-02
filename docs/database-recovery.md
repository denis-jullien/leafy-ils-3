# Database backups and recovery

The SQLite database includes volunteer accounts, family records, loans, and cover bytes.
Keep both continuous Litestream replication and scheduled Fly volume snapshots. Snapshots
are daily fallback copies, not a substitute for replicating recent loans.

## Continuous backups to Tigris

For `leafy-ils`, the existing Tigris bucket is `proud-hill-933`. Use the dedicated prefix
`leafy-ils-3/library` so this database never mixes with older versions' backups.
The app's existing `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets work with
Litestream 0.3.13. Do not copy credentials into this repository.

```sh
fly secrets set --app leafy-ils --stage \
  LITESTREAM_REPLICA_URL=s3://proud-hill-933/leafy-ils-3/library \
  LITESTREAM_ENDPOINT=https://fly.storage.tigris.dev \
  LITESTREAM_REGION=auto
fly deploy --app leafy-ils --ha=false
```

Replication attempts to upload WAL changes every 10 seconds, with daily Litestream snapshots
and 30-day retention.
This is a target, not a guarantee: outages and upload failures can delay backups.
An idle stopped machine does not replicate; Litestream flushes changes on graceful shutdown.
Check logs for successful snapshot and WAL uploads, not just process startup:

```sh
fly logs --app leafy-ils
fly ssh console --app leafy-ils -C 'litestream snapshots -config /etc/litestream.yml /data/library.db'
```

Missing credentials, denied bucket access, or upload errors must be resolved before treating
replication as working. Daily Fly snapshots remain enabled with seven-day retention in
`fly.toml` (the existing volume was also configured this way).

## Startup behavior

- Existing database: check SQLite integrity, foreign keys, and core Leafy tables before
  starting or applying migrations. Invalid files are preserved and startup stops.
- Missing database with a configured replica: restore to a temporary directory on the
  same volume, verify it, then publish without overwriting an existing destination.
  Failed, missing, or invalid backups stop startup; they never become a blank library.
- Missing database without a replica: stop and recover a volume snapshot.
- Intentional first-ever setup: with no replica configured, temporarily set
  `DATABASE_INITIALIZE=1`. Remove it immediately after the first successful deployment.
  This flag never overrides a failed replica restore.
- If the database is missing but WAL/SHM files remain, preserve those files and stop.

Local `npm run dev` does not use the container entrypoint and still supports first-run setup.
Do not delete a suspect database or its sidecars to make startup pass.

## Verify a remote restore without changing production

Wake the machine with a request to `/health` if necessary. Open an SSH console and run:

```sh
cd /app
RECOVERY_DIR=$(mktemp -d /tmp/leafy-recovery.XXXXXX)
litestream restore -config /etc/litestream.yml -o "$RECOVERY_DIR/library.db" /data/library.db
node scripts/database-recovery.mjs check "$RECOVERY_DIR/library.db"
```

This leaves the live database unchanged. Inspect the restored database with a read-only
`better-sqlite3` connection; check accounts, family and book counts, open loans, and covers
against a known point in time. Integrity checks alone cannot prove that the backup is recent
or contains the records you expect. The temporary file contains private data: remove the
temporary directory when finished. Never serve this copy publicly.

## Recovery after volume loss

Pause desk operations and disable automatic starts before replacing a failed volume.
Preserve the original volume and machine configuration for investigation. Restore a snapshot
to a **new** volume, or create a new empty volume to restore from Litestream on startup:

```sh
fly volumes list --app leafy-ils
fly volumes snapshots list <original-volume-id> --app leafy-ils
fly volumes create data --app leafy-ils --region cdg --size 3 \
  --snapshot-id <snapshot-id> --snapshot-retention 7
```

Fly restores a snapshot into a new volume of equal or greater size. Attach the recovered
volume at `/data` to the replacement machine using the current app image/configuration.
Ensure exactly one machine serves the recovered database. Do not use `DATABASE_INITIALIZE`.
Verify `/health`, sign-in, recent loans, and covers before reopening the desk. Keep the old
volume until the recovered data is confirmed. Record the recovery point and reconcile any
loans made after that backup.

For an empty replacement volume with a configured Litestream replica, the entrypoint restores
the latest backup automatically. An existing snapshot database is used as-is; startup does
not merge it with a newer replica. Choose the freshest trustworthy recovery source.

## Accidental edits and point-in-time recovery

Restore the selected UTC timestamp into a separate output file first:

```sh
litestream restore -config /etc/litestream.yml \
  -timestamp <YYYY-MM-DDTHH:MM:SSZ> -o /tmp/recovered-library.db /data/library.db
node scripts/database-recovery.mjs check /tmp/recovered-library.db
```

The timestamp must be covered by the replica's retained history. Validate the recovered
records before replacing production. Stop writes and Litestream, preserve the current
database with its WAL/SHM files, then switch to the recovered database on a separate volume.
Use a new replica prefix after intentionally rolling back, preserving the previous replica
for investigation. A deployment rollback does not undo database migrations.

## Automated recovery drill

```sh
npm run test:recovery
# Install Litestream 0.3.13 (the production Dockerfile's version) on PATH:
npm run test:recovery:drill
```

The drill uses a disposable directory and a local file replica. It applies real migrations,
creates representative accounts, loans and covers, observes a snapshot, makes later WAL
writes, stops replication gracefully, removes the source database, and restores it. Every
fixture record and migration is compared with the original. It never reads the local or
production library database. Repeat remote restore verification after changes to credentials,
bucket policy, Litestream version, and periodically during operation.

References: [Litestream 0.3 restore command](https://litestream.io/v0.3/reference/restore/),
[Litestream 0.3 configuration](https://litestream.io/v0.3/reference/config/), and
[Fly volume snapshots](https://docs.fly.io/volumes/snapshots).

## Verification record

On 2026-10-02, `leafy-ils:recovery-20261002` was deployed with Litestream 0.3.13.
Snapshot and WAL uploads to `proud-hill-933/leafy-ils-3/library` succeeded. A restore into
a disposable `/tmp` database passed integrity and foreign-key checks; SHA-256 digests
of every row in all 16 application tables matched read-only queries of the live database.
The temporary restored copy was removed, and the app's Fly health check passed.
The local drill also verified cover bytes and writes made after the initial snapshot.
All 13 recovery tests and 66 existing unit tests passed.

This verifies recovery at that point in time. It does not replace checking future uploads
and repeating restore drills. Recovery from a Fly volume snapshot has not been rehearsed;
a fresh seven-day-retention snapshot was created before deployment as a fallback.
