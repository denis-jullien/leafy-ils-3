import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { restoreDatabase } from './database-recovery.mjs';
import { createFixture, fixtureRecords } from './recovery-fixture.mjs';

const directory = mkdtempSync(join(tmpdir(), 'leafy-recovery-drill-'));
let db;
let replicator;
let stopped;
try {
	const source = join(directory, 'source.db');
	const config = join(directory, 'litestream.yml');
	db = createFixture(source);
	writeFileSync(
		config,
		`dbs:\n  - path: ${JSON.stringify(source)}\n    replicas:\n      - path: ${JSON.stringify(join(directory, 'replica'))}\n        sync-interval: 100ms\n`
	);
	replicator = spawn('litestream', ['replicate', '-config', config], { stdio: 'inherit' });
	stopped = new Promise((resolve, reject) => {
		replicator.once('error', reject);
		replicator.once('exit', (code) => resolve(code));
	});
	// Observe the initial snapshot before a later WAL write, proving both are restored.
	let backedUp = false;
	for (let i = 0; i < 100; i++) {
		if (replicator.exitCode !== null) throw new Error('Litestream exited before making a backup');
		const result = spawnSync('litestream', ['snapshots', '-config', config, source], {
			encoding: 'utf8'
		});
		if (result.status === 0 && result.stdout.trim().split('\n').length > 1) {
			backedUp = true;
			break;
		}
		await delay(100);
	}
	if (!backedUp) throw new Error('Timed out waiting for the initial backup snapshot');
	db.exec(
		"UPDATE loans SET returned_at = 1234; UPDATE families SET name = 'Updated after snapshot'"
	);
	const expected = fixtureRecords(db);
	// Graceful shutdown flushes pending WAL frames; matches container shutdown behavior.
	replicator.kill('SIGTERM');
	const exitCode = await stopped;
	if (exitCode !== 0) throw new Error(`Litestream replication exited with ${exitCode}`);
	db.close();
	db = undefined;
	// Simulate loss of the source, while retaining only the replica.
	for (const suffix of ['', '-wal', '-shm']) rmSync(source + suffix, { force: true });
	restoreDatabase(source, config);
	const restored = new Database(source, { readonly: true });
	try {
		assert.deepEqual(fixtureRecords(restored), expected);
	} finally {
		restored.close();
	}
	console.log(
		'Recovery drill passed: accounts, loans, cover bytes, migrations, and post-snapshot writes restored.'
	);
} finally {
	if (replicator && replicator.exitCode === null) {
		replicator.kill('SIGTERM');
		await stopped.catch(() => {});
	}
	db?.close();
	rmSync(directory, { recursive: true, force: true });
}
