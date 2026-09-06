import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from './db/client';
import { books, type Book } from './db/schema';
import { bookBarcode } from '$lib/barcodes';
import { parseIsbn } from '$lib/isbn';
import type { bookSchema } from '$lib/schemas';

export type BookInput = z.infer<typeof bookSchema>;

export class DuplicateBookError extends Error {
	constructor(
		public field: 'isbn13',
		public existing: Book
	) {
		super(`Duplicate ${field}`);
	}
}

function toRow(input: BookInput) {
	const isbn13 = input.isbn ? parseIsbn(input.isbn) : null;
	// rfidUid is not on the form for now; the column stays untouched.
	return {
		isbn13,
		title: input.title,
		authors: input.authors ?? null,
		publisher: input.publisher ?? null,
		publishedYear: input.publishedYear ?? null,
		language: input.language ?? null,
		pageCount: input.pageCount ?? null,
		description: input.description ?? null,
		coverUrl: input.coverUrl ?? null,
		shelfId: input.shelfId ?? null,
		featured: input.featured,
		notes: input.notes ?? null,
		status: input.status
	};
}

function assertUnique(db: Db, row: ReturnType<typeof toRow>, exceptId?: number) {
	if (row.isbn13) {
		const hit = db.select().from(books).where(eq(books.isbn13, row.isbn13)).get();
		if (hit && hit.id !== exceptId) throw new DuplicateBookError('isbn13', hit);
	}
}

/** Insert a book; barcode = ISBN-13, or an internal B-label when there is no ISBN. */
export function createBook(db: Db, input: BookInput): Book {
	const row = toRow(input);
	assertUnique(db, row);
	return db.transaction((tx) => {
		const inserted = tx.insert(books).values(row).returning().get();
		const barcode = row.isbn13 ?? bookBarcode(inserted.id);
		return tx.update(books).set({ barcode }).where(eq(books.id, inserted.id)).returning().get();
	});
}

export function updateBook(db: Db, id: number, input: BookInput): Book {
	const row = toRow(input);
	assertUnique(db, row, id);
	const barcode = row.isbn13 ?? bookBarcode(id);
	return db
		.update(books)
		.set({ ...row, barcode })
		.where(eq(books.id, id))
		.returning()
		.get();
}
