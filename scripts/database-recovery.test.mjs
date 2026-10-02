import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { checkDatabase, restoreDatabase } from './database-recovery.mjs';
import { createFixture, fixtureRecords } from './recovery-fixture.mjs';

let directory;
let path;
let fixture;
let env;

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), 'leafy-recovery-test-'));
	path = join(directory, 'library.db');
	fixture = join(directory, 'fixture.db');
	createFixture(fixture).close();
	env = {
		...process.env,
		PATH: `${directory}:${process.env.PATH}`,
		DATABASE_URL: path,
		DATABASE_INITIALIZE: '0',
		LITESTREAM_REPLICA_URL: '',
		LITESTREAM_CONFIG: join(directory, 'config.yml'),
		RECOVERY_FIXTURE: fixture,
		RECOVERY_MARKER: join(directory, 'app-started'),
		RECOVERY_NODE: process.execPath
	};
	// CLI subprocesses must not inherit the parent Node test runner's IPC context.
	delete env.NODE_TEST_CONTEXT;
	writeFileSync(
		join(directory, 'node'),
		`#!/bin/sh
if [ "$1" = "build" ]; then touch "$RECOVERY_MARKER"; exit 0; fi
exec "$RECOVERY_NODE" "$@"
`,
		{ mode: 0o755 }
	);
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

function start() {
	return spawnSync('bash', [resolve('scripts/start.sh')], { env, encoding: 'utf8' });
}

function replica(script) {
	env.LITESTREAM_REPLICA_URL = 'file:///unused-test-replica';
	writeFileSync(
		join(directory, 'litestream'),
		`#!/bin/sh
if [ "$1" = "replicate" ]; then touch "$RECOVERY_MARKER"; exit 0; fi
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then shift; output="$1"; fi
  shift
done
${script}
`,
		{ mode: 0o755 }
	);
}

test('missing database cannot silently become a new library', () => {
	assert.equal(start().status, 1);
	assert.equal(existsSync(path), false);
	assert.equal(existsSync(env.RECOVERY_MARKER), false);
});

test('intentional first-run setup can start without a replica', () => {
	env.DATABASE_INITIALIZE = '1';
	assert.equal(start().status, 0);
	assert.equal(existsSync(env.RECOVERY_MARKER), true);
});

test('valid existing database starts and retains its records', () => {
	createFixture(path).close();
	assert.equal(start().status, 0);
	assert.doesNotThrow(() => checkDatabase(path));
});

test('corrupt existing database blocks startup', () => {
	writeFileSync(path, 'not SQLite');
	assert.equal(start().status, 1);
	assert.equal(existsSync(env.RECOVERY_MARKER), false);
});

test('zero-byte existing database is preserved and blocks startup', () => {
	writeFileSync(path, '');
	env.DATABASE_INITIALIZE = '1';
	assert.equal(start().status, 1);
	assert.equal(existsSync(path), true);
	assert.equal(existsSync(env.RECOVERY_MARKER), false);
});

test('manual restoration refuses to overwrite an existing database', () => {
	createFixture(path).close();
	assert.throws(() => restoreDatabase(path, env.LITESTREAM_CONFIG), /Refusing to overwrite/);
	assert.doesNotThrow(() => checkDatabase(path));
});

test('valid SQLite without library tables blocks startup', () => {
	const db = new Database(path);
	db.exec('CREATE TABLE unrelated (id INTEGER)');
	db.close();
	assert.equal(start().status, 1);
});

test('broken foreign-key references block startup', () => {
	const db = createFixture(path);
	db.pragma('foreign_keys = OFF');
	db.exec('UPDATE loans SET family_id = 999');
	db.close();
	assert.equal(start().status, 1);
});

test('restore failure leaves no database and never starts the application', () => {
	replica('printf partial > "$output"; exit 1');
	env.DATABASE_INITIALIZE = '1';
	assert.equal(start().status, 1);
	assert.equal(existsSync(path), false);
	assert.equal(existsSync(env.RECOVERY_MARKER), false);
	assert.equal(
		readdirSync(directory).some((p) => p.startsWith('.leafy-restore-')),
		false
	);
});

test('missing backup blocks startup even when restore incorrectly exits successfully', () => {
	replica('exit 0');
	assert.equal(start().status, 1);
	assert.equal(existsSync(path), false);
	assert.equal(existsSync(env.RECOVERY_MARKER), false);
});

test('corrupt restored data is rejected before publication', () => {
	replica('printf corrupt > "$output"');
	assert.equal(start().status, 1);
	assert.equal(existsSync(path), false);
	assert.equal(existsSync(env.RECOVERY_MARKER), false);
});

test('successful recovery preserves accounts, loans, covers, and migration history', () => {
	replica('cp "$RECOVERY_FIXTURE" "$output"');
	const result = start();
	assert.equal(result.status, 0, result.stderr);
	assert.equal(existsSync(env.RECOVERY_MARKER), true);
	const original = new Database(fixture, { readonly: true });
	const restored = new Database(path, { readonly: true });
	try {
		assert.deepEqual(fixtureRecords(restored), fixtureRecords(original));
	} finally {
		original.close();
		restored.close();
	}
});

test('orphaned WAL files block restoration and are preserved', () => {
	writeFileSync(path + '-wal', 'valuable WAL');
	replica('cp "$RECOVERY_FIXTURE" "$output"');
	assert.equal(start().status, 1);
	assert.equal(existsSync(path + '-wal'), true);
	assert.equal(existsSync(path), false);
});
