import { and, asc, desc, eq, like, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from './db/client';
import { books, loans, shelves } from './db/schema';
import { parseIsbn } from '$lib/isbn';

/** What the public may see about a book: no notes, no barcodes, no RFID. */
export interface PublicBook {
	id: number;
	title: string;
	authors: string | null;
	publisher: string | null;
	publishedYear: number | null;
	coverUrl: string | null;
	shelf: string | null;
	featured: boolean;
	available: boolean;
	isNew: boolean;
}

/** The public detail page shows a little more, still nothing about who has it. */
export interface PublicBookDetail extends PublicBook {
	description: string | null;
	pageCount: number | null;
	language: string | null;
	/** When the book is out: the date it is expected back. */
	dueAt: Date | null;
	isbn13: string | null;
}

const NEW_FOR_DAYS = 30;

const publicColumns = {
	id: books.id,
	title: books.title,
	authors: books.authors,
	publisher: books.publisher,
	publishedYear: books.publishedYear,
	coverUrl: books.coverUrl,
	shelf: shelves.name,
	featured: books.featured,
	createdAt: books.createdAt,
	dueAt: loans.dueAt
};

const onLoanJoin = sql`${loans.bookId} = ${books.id} AND ${loans.returnedAt} IS NULL`;

function toPublic(
	r: { createdAt: Date; dueAt: Date | null } & Omit<PublicBook, 'available' | 'isNew'>
): PublicBook {
	const { createdAt, dueAt, ...rest } = r;
	return {
		...rest,
		available: dueAt === null,
		isNew: Date.now() - createdAt.getTime() < NEW_FOR_DAYS * 86400_000
	};
}

export interface CatalogueQuery {
	q?: string;
	shelfId?: number | null;
	limit?: number;
}

const shelfFilter = (shelfId: number | null | undefined): SQL | undefined =>
	shelfId == null ? undefined : eq(books.shelfId, shelfId);

/**
 * Public catalogue search: title, author or publisher fragment, or an exact ISBN,
 * optionally within one shelf. Empty query + shelf lists that shelf.
 */
export function searchCatalogue(
	db: Db,
	{ q = '', shelfId = null, limit = 60 }: CatalogueQuery
): PublicBook[] {
	const term = q.trim();
	const filters: SQL[] = [eq(books.status, 'active')];
	if (term) {
		const isbn = parseIsbn(term);
		const pattern = `%${term}%`;
		filters.push(
			isbn
				? eq(books.isbn13, isbn)
				: or(
						like(books.title, pattern),
						like(books.authors, pattern),
						like(books.publisher, pattern)
					)!
		);
	}
	const byShelf = shelfFilter(shelfId);
	if (byShelf) filters.push(byShelf);
	return db
		.select(publicColumns)
		.from(books)
		.leftJoin(loans, onLoanJoin)
		.leftJoin(shelves, eq(shelves.id, books.shelfId))
		.where(and(...filters))
		.orderBy(asc(books.title))
		.limit(limit)
		.all()
		.map(toPublic);
}

export function getPublicBook(db: Db, id: number): PublicBookDetail | null {
	const row = db
		.select({
			...publicColumns,
			description: books.description,
			pageCount: books.pageCount,
			language: books.language,
			isbn13: books.isbn13
		})
		.from(books)
		.leftJoin(loans, onLoanJoin)
		.leftJoin(shelves, eq(shelves.id, books.shelfId))
		.where(and(eq(books.id, id), eq(books.status, 'active')))
		.get();
	if (!row) return null;
	const { description, pageCount, language, isbn13, ...rest } = row;
	return { ...toPublic(rest), description, pageCount, language, isbn13, dueAt: row.dueAt };
}

/** The welcome rail: volunteers' picks first, then the newest arrivals. */
export function featuredBooks(db: Db, shelfId: number | null = null, limit = 12): PublicBook[] {
	return db
		.select(publicColumns)
		.from(books)
		.leftJoin(loans, onLoanJoin)
		.leftJoin(shelves, eq(shelves.id, books.shelfId))
		.where(and(eq(books.status, 'active'), shelfFilter(shelfId)))
		.orderBy(desc(books.featured), desc(books.createdAt))
		.limit(limit)
		.all()
		.map(toPublic);
}
