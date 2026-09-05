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
		shelf: text('shelf'),
		/** One of CATEGORIES in $lib/config, shown as filter chips on the public site. */
		category: text('category'),
		/** "Coup de cœur": picked by the volunteers, shown first on the welcome page. */
		featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
		notes: text('notes'),
		status: text('status', { enum: ['active', 'lost', 'withdrawn'] })
			.notNull()
			.default('active'),
		...timestamps
	},
	(t) => [index('books_title_idx').on(t.title)]
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

export type Family = typeof families.$inferSelect;
export type NewFamily = typeof families.$inferInsert;
export type Member = typeof members.$inferSelect;
export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type Loan = typeof loans.$inferSelect;
