import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Db } from './client';

/** Apply pending SQL migrations from the `drizzle/` folder. Safe to call on every start. */
export function runMigrations(db: Db, migrationsFolder = 'drizzle') {
	migrate(db, { migrationsFolder });
}
