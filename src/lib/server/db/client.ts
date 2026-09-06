import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { squash } from '$lib/search';

export type Db = BetterSQLite3Database<typeof schema>;

/**
 * Open a SQLite database with the pragmas we want everywhere:
 * WAL for concurrent readers (and Litestream), foreign keys on, busy timeout
 * so a checkout transaction never fails just because a page load was reading.
 */
export function createDb(url: string): Db {
	const client = new Database(url);
	client.pragma('journal_mode = WAL');
	client.pragma('foreign_keys = ON');
	client.pragma('busy_timeout = 5000');
	// squash(text) in SQL: the loose-matching key used by the searches (see $lib/search).
	client.function('squash', { deterministic: true }, (s) => squash(String(s ?? '')));
	return drizzle(client, { schema });
}
