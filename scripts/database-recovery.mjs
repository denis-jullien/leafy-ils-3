import { lstatSync, mkdtempSync, linkSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';

const REQUIRED_TABLES = ['user', 'books', 'families', 'loans', '__drizzle_migrations'];

function assertAbsent(path) {
	try {
		lstatSync(path);
	} catch (err) {
		if (err.code === 'ENOENT') return;
		throw err;
	}
	throw new Error(`Refusing to overwrite ${path}`);
}

/** Read only: never create a database or migrate the backup being checked. */
export function checkDatabase(path) {
	if (!statSync(path).isFile() || statSync(path).size === 0)
		throw new Error('Database is empty or is not a regular file');
	const db = new Database(path, { readonly: true, fileMustExist: true });
	try {
		const integrity = db.pragma('quick_check').map((row) => row.quick_check);
		if (integrity.length !== 1 || integrity[0] !== 'ok')
			throw new Error(`SQLite integrity check failed: ${integrity.join('; ')}`);
		if (db.pragma('foreign_key_check').length)
			throw new Error('Database contains broken foreign-key references');
		const tables = new Set(
			db
				.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
				.all()
				.map((r) => r.name)
		);
		if (REQUIRED_TABLES.some((table) => !tables.has(table)))
			throw new Error('Database is missing the Leafy ILS schema or migration history');
	} finally {
		db.close();
	}
}

/** Restore beside the destination, validate, then publish without overwriting anything. */
export function restoreDatabase(path, config, timestamp) {
	for (const suffix of ['', '-wal', '-shm']) assertAbsent(path + suffix);
	const temporary = mkdtempSync(join(dirname(resolve(path)), '.leafy-restore-'));
	const candidate = join(temporary, 'library.db');
	try {
		const args = ['restore', '-config', config, '-o', candidate];
		if (timestamp) args.push('-timestamp', timestamp);
		args.push(path);
		const result = spawnSync('litestream', args, { stdio: 'inherit' });
		if (result.error) throw result.error;
		if (result.status !== 0) throw new Error('Litestream restore failed; startup stopped');
		checkDatabase(candidate);
		// A hard link on the same filesystem fails if the destination already exists.
		linkSync(candidate, path);
	} finally {
		rmSync(temporary, { recursive: true, force: true });
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try {
		const [command, path, config, timestamp] = process.argv.slice(2);
		if (command === 'check' && path) checkDatabase(path);
		else if (command === 'restore' && path && config) restoreDatabase(path, config, timestamp);
		else
			throw new Error('Usage: database-recovery.mjs check PATH | restore PATH CONFIG [TIMESTAMP]');
		console.log(`Database ${command === 'restore' ? 'restored and verified' : 'verified'}.`);
	} catch (err) {
		console.error(`Database recovery: ${err.message}`);
		process.exitCode = 1;
	}
}
