import { and, eq, isNull } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from './db/client';
import { books, depositMoves, type Book } from './db/schema';
import { bookBarcode } from '$lib/barcodes';
import { parseIsbn } from '$lib/isbn';
import type { bookSchema } from '$lib/schemas';

export type BookInput = z.infer<typeof bookSchema>;

export class DuplicateBookError extends Error {
	constructor(
		public field: 'isbn13' | 'barcode',
		public existing: Book
	) {
		super(`Duplicate ${field}`);
	}
}

export class MissingBarcodeError extends Error {
	constructor() {
		super("L'étiquette du livre est obligatoire pour un livre en dépôt");
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
		status: input.status,
		depositId: input.depositId ?? null,
		/** Deposit books wear the lender's sticker; own books get theirs after insert. */
		barcode: input.depositId ? (input.barcode?.trim() ?? null) : null
	};
}

/**
 * The library holds one copy of a title, so an ISBN is unique among its own
 * books. A deposit may bring the same title again: those are told apart by the
 * lender's sticker, which is unique on its own.
 */
function assertUnique(db: Db, row: ReturnType<typeof toRow>, exceptId?: number) {
	if (row.depositId === null && row.isbn13) {
		const hit = db
			.select()
			.from(books)
			.where(and(eq(books.isbn13, row.isbn13), isNull(books.depositId)))
			.get();
		if (hit && hit.id !== exceptId) throw new DuplicateBookError('isbn13', hit);
	}
	if (row.depositId !== null) {
		if (!row.barcode) throw new MissingBarcodeError();
		const hit = db.select().from(books).where(eq(books.barcode, row.barcode)).get();
		if (hit && hit.id !== exceptId) throw new DuplicateBookError('barcode', hit);
	}
}

/**
 * Insert a book. Own books: barcode = ISBN-13, or an internal B-label when
 * there is no ISBN. Deposit books keep the sticker and log their arrival.
 */
export function createBook(db: Db, input: BookInput, userId?: string): Book {
	const row = toRow(input);
	assertUnique(db, row);
	return db.transaction((tx) => {
		const inserted = tx.insert(books).values(row).returning().get();
		if (row.depositId !== null) {
			tx.insert(depositMoves)
				.values({ depositId: row.depositId, bookId: inserted.id, kind: 'in', by: userId })
				.run();
			return inserted;
		}
		const barcode = row.isbn13 ?? bookBarcode(inserted.id);
		return tx.update(books).set({ barcode }).where(eq(books.id, inserted.id)).returning().get();
	});
}

export function updateBook(db: Db, id: number, input: BookInput, userId?: string): Book {
	const row = toRow(input);
	assertUnique(db, row, id);
	const barcode = row.depositId !== null ? row.barcode : (row.isbn13 ?? bookBarcode(id));
	return db.transaction((tx) => {
		const before = tx
			.select({ depositId: books.depositId })
			.from(books)
			.where(eq(books.id, id))
			.get();
		const updated = tx
			.update(books)
			.set({ ...row, barcode })
			.where(eq(books.id, id))
			.returning()
			.get();
		// Moved into a deposit by hand: that is an arrival too.
		if (row.depositId !== null && before?.depositId !== row.depositId)
			tx.insert(depositMoves)
				.values({ depositId: row.depositId, bookId: id, kind: 'in', by: userId })
				.run();
		return updated;
	});
}
