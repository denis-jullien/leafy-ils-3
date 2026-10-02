import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

/** Disposable library with real migrations and representative records, never live data. */
export function createFixture(path) {
	const db = new Database(path);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	migrate(drizzle(db), { migrationsFolder: 'drizzle' });
	db.exec(`
		INSERT INTO user (id, name, email, role) VALUES ('drill-admin', 'Recovery drill', 'drill@example.invalid', 'admin');
		INSERT INTO families (id, name, created_at, updated_at) VALUES (1, 'Drill family', 1, 1);
		INSERT INTO books (id, title, created_at, updated_at) VALUES (1, 'Drill book', 1, 1);
		INSERT INTO loans (book_id, family_id, checked_out_at, due_at, checked_out_by)
		VALUES (1, 1, 1, 2, 'drill-admin');
	`);
	db.prepare(
		`INSERT INTO covers (book_id, mime, bytes, width, height, hash, updated_at)
		VALUES (1, 'image/webp', ?, 100, 150, 'drill-cover', 1)`
	).run(Buffer.from('drill cover bytes'));
	return db;
}

export function fixtureRecords(db) {
	return Object.fromEntries(
		['user', 'families', 'books', 'loans', 'covers', 'shelves', '__drizzle_migrations'].map(
			(table) => [table, db.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all()]
		)
	);
}
