import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export * from './auth.schema';

const timestamps = {
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date())
};

/** A membership account. Every loan belongs to a family, not to a person. */
export const families = sqliteTable('families', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	/** Printed on the family card, e.g. F000042. Filled in right after insert. */
	barcode: text('barcode').unique(),
	email: text('email'),
	phone: text('phone'),
	address: text('address'),
	notes: text('notes'),
	status: text('status', { enum: ['active', 'inactive'] })
		.notNull()
		.default('active'),
	...timestamps
});

/** Optional: the people inside a family, for the volunteer's benefit only. */
export const members = sqliteTable(
	'members',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		familyId: integer('family_id')
			.notNull()
			.references(() => families.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		birthYear: integer('birth_year'),
		notes: text('notes'),
		...timestamps
	},
	(t) => [index('members_family_idx').on(t.familyId)]
);

/**
 * A shelf ("rayon"): where a book lives and how the public sees it grouped.
 * Keywords and Dewey rules let the ISBN lookup propose one automatically.
 */
export const shelves = sqliteTable(
	'shelves',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull().unique(),
		/** Rules are tried in this order; the first shelf that matches wins. */
		position: integer('position').notNull().default(0),
		/** Comma-separated words or phrases matched against subjects, genres and signals. */
		keywords: text('keywords'),
		/** Comma-separated Dewey prefixes ("741.5") or ranges ("800-899"). */
		dewey: text('dewey'),
		/** One sentence describing the shelf, used by the optional local embedding model. */
		description: text('description'),
		...timestamps
	},
	(t) => [index('shelves_position_idx').on(t.position)]
);

/**
 * One row per physical book. The library holds one copy per title, so the
 * book *is* the item. The barcode defaults to the ISBN-13; books without an
 * ISBN get an internal barcode (B000123) and a printed label.
 */
export const books = sqliteTable(
	'books',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		isbn13: text('isbn13').unique(),
		barcode: text('barcode').unique(),
		rfidUid: text('rfid_uid').unique(),
		title: text('title').notNull(),
		authors: text('authors'), // "Surname Name; Surname Name"
		publisher: text('publisher'),
		publishedYear: integer('published_year'),
		language: text('language'),
		pageCount: integer('page_count'),
		description: text('description'),
		coverUrl: text('cover_url'),
		shelfId: integer('shelf_id').references(() => shelves.id, { onDelete: 'set null' }),
		/** "Coup de cœur": picked by the volunteers, shown first on the welcome page. */
		featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
		notes: text('notes'),
		status: text('status', { enum: ['active', 'lost', 'withdrawn'] })
			.notNull()
			.default('active'),
		...timestamps
	},
	(t) => [index('books_title_idx').on(t.title), index('books_shelf_idx').on(t.shelfId)]
);

export const loans = sqliteTable(
	'loans',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		bookId: integer('book_id')
			.notNull()
			.references(() => books.id),
		familyId: integer('family_id')
			.notNull()
			.references(() => families.id),
		checkedOutAt: integer('checked_out_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date()),
		dueAt: integer('due_at', { mode: 'timestamp_ms' }).notNull(),
		returnedAt: integer('returned_at', { mode: 'timestamp_ms' }),
		renewals: integer('renewals').notNull().default(0),
		/** Volunteer (auth user id) who handled the transaction. */
		checkedOutBy: text('checked_out_by'),
		returnedBy: text('returned_by')
	},
	(t) => [
		index('loans_family_idx').on(t.familyId),
		index('loans_book_idx').on(t.bookId),
		// A book can only be out once at a time. Enforced by the database, not by hope.
		uniqueIndex('loans_open_book_uidx')
			.on(t.bookId)
			.where(sql`returned_at IS NULL`)
	]
);

/** Public agenda, edited by volunteers from the desk. Past events hide on their own. */
export const events = sqliteTable(
	'events',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** ISO date, YYYY-MM-DD, in the library's timezone. */
		date: text('date').notNull(),
		/** Free text, e.g. "10h30" or "14h – 16h". */
		time: text('time'),
		title: text('title').notNull(),
		/** Audience label shown as a tag: Jeunesse, Adultes, Tout public… */
		tag: text('tag'),
		description: text('description'),
		free: integer('free', { mode: 'boolean' }).notNull().default(true),
		...timestamps
	},
	(t) => [index('events_date_idx').on(t.date)]
);

export type Shelf = typeof shelves.$inferSelect;
export type Family = typeof families.$inferSelect;
export type NewFamily = typeof families.$inferInsert;
export type Member = typeof members.$inferSelect;
export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type Loan = typeof loans.$inferSelect;
export type Event = typeof events.$inferSelect;
