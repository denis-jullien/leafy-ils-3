import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import type { Db } from './db/client';
import { books } from './db/schema';
import { lookupIsbn } from './metadata';

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
		if (meta?.coverUrl) patch.coverUrl = meta.coverUrl;
		if (meta?.description && !book.description) patch.description = meta.description;
		if (meta?.publisher && !book.publisher) patch.publisher = meta.publisher;
		if (meta?.publishedYear && !book.publishedYear) patch.publishedYear = meta.publishedYear;
		if (meta?.pageCount && !book.pageCount) patch.pageCount = meta.pageCount;
		if (meta?.language && !book.language) patch.language = meta.language;
		// Remember we tried, so the next batch moves on: an empty string means "looked, none".
		if (!patch.coverUrl) patch.coverUrl = '';
		else filled++;
		db.update(books).set(patch).where(eq(books.id, book.id)).run();
	}
	const remaining = db.select({ id: books.id }).from(books).where(where).all().length;
	return { tried: todo.length, filled, remaining };
}
