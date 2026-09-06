import { and, eq, isNotNull, isNull, like } from 'drizzle-orm';
import type { Db } from './db/client';
import { books } from './db/schema';
import { lookupIsbn } from './metadata';
import { proposeShelf } from './shelves';
import { importCoverFromUrl } from './cover-store';

export interface FillResult {
	tried: number;
	filled: number;
	remaining: number;
}

/**
 * Look up books that have an ISBN but no cover, and store the first cover that
 * checks out. Empty descriptions and publishers get filled on the way. Runs in
 * small batches so a click at the desk never takes more than a few seconds.
 */
export async function fillMissingCovers(db: Db, batch = 10): Promise<FillResult> {
	const where = and(isNotNull(books.isbn13), isNull(books.coverUrl), eq(books.status, 'active'));
	const todo = db.select().from(books).where(where).limit(batch).all();
	let filled = 0;
	for (const book of todo) {
		const meta = await lookupIsbn(book.isbn13!, { timeoutMs: 6000 });
		const patch: Partial<typeof books.$inferInsert> = {};
		let stored = false;
		if (meta?.coverUrl) {
			try {
				await importCoverFromUrl(db, book.id, meta.coverUrl, meta.coverSource ?? 'lookup');
				stored = true;
			} catch (err) {
				console.warn(`[covers] could not store cover for book ${book.id}:`, (err as Error).message);
			}
		}
		if (meta?.description && !book.description) patch.description = meta.description;
		if (meta?.publisher && !book.publisher) patch.publisher = meta.publisher;
		if (meta?.publishedYear && !book.publishedYear) patch.publishedYear = meta.publishedYear;
		if (meta?.pageCount && !book.pageCount) patch.pageCount = meta.pageCount;
		if (meta?.language && !book.language) patch.language = meta.language;
		if (meta && book.shelfId === null) {
			const match = proposeShelf(db, meta);
			if (match) patch.shelfId = match.shelf.id;
		}
		// Remember we tried, so the next batch moves on: an empty string means "looked, none".
		if (stored) filled++;
		else patch.coverUrl = '';
		if (Object.keys(patch).length) db.update(books).set(patch).where(eq(books.id, book.id)).run();
	}
	const remaining = db.select({ id: books.id }).from(books).where(where).all().length;
	return { tried: todo.length, filled, remaining };
}

/** Bring covers that are still external URLs into the store, a batch at a time. */
export async function importExternalCovers(db: Db, batch = 10): Promise<FillResult> {
	const where = and(like(books.coverUrl, 'http%'), eq(books.status, 'active'));
	const todo = db
		.select({ id: books.id, coverUrl: books.coverUrl })
		.from(books)
		.where(where)
		.limit(batch)
		.all();
	let filled = 0;
	for (const b of todo) {
		try {
			await importCoverFromUrl(db, b.id, b.coverUrl!, 'url');
			filled++;
		} catch (err) {
			console.warn(`[covers] import failed for book ${b.id}:`, (err as Error).message);
			// Give up on this one so the batch moves on; the lookup can find it again later.
			db.update(books).set({ coverUrl: '' }).where(eq(books.id, b.id)).run();
		}
	}
	const remaining = db.select({ id: books.id }).from(books).where(where).all().length;
	return { tried: todo.length, filled, remaining };
}

export function countExternalCovers(db: Db) {
	return db
		.select({ id: books.id })
		.from(books)
		.where(and(like(books.coverUrl, 'http%'), eq(books.status, 'active')))
		.all().length;
}
