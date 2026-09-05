import { and, asc, desc, eq, like, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from './db/client';
import { books, loans } from './db/schema';
import { parseIsbn } from '$lib/isbn';
import type { CategoryId } from '$lib/config';

/** What the public may see about a book: no notes, no barcodes, no RFID. */
export interface PublicBook {
	id: number;
	title: string;
	authors: string | null;
	publisher: string | null;
	publishedYear: number | null;
	coverUrl: string | null;
	category: string | null;
	featured: boolean;
	available: boolean;
	isNew: boolean;
}

const NEW_FOR_DAYS = 30;

const publicColumns = {
	id: books.id,
	title: books.title,
	authors: books.authors,
	publisher: books.publisher,
	publishedYear: books.publishedYear,
	coverUrl: books.coverUrl,
	category: books.category,
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
	category?: CategoryId | null;
	limit?: number;
}

/**
 * Public catalogue search: title, author or publisher fragment, or an exact ISBN,
 * optionally within one category. Empty query + category lists that category.
 */
export function searchCatalogue(
	db: Db,
	{ q = '', category = null, limit = 60 }: CatalogueQuery
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
	if (category) filters.push(eq(books.category, category));
	return db
		.select(publicColumns)
		.from(books)
		.leftJoin(loans, onLoanJoin)
		.where(and(...filters))
		.orderBy(asc(books.title))
		.limit(limit)
		.all()
		.map(toPublic);
}

/** The welcome rail: volunteers' picks first, then the newest arrivals. */
export function featuredBooks(
	db: Db,
	category: CategoryId | null = null,
	limit = 12
): PublicBook[] {
	return db
		.select(publicColumns)
		.from(books)
		.leftJoin(loans, onLoanJoin)
		.where(and(eq(books.status, 'active'), category ? eq(books.category, category) : undefined))
		.orderBy(desc(books.featured), desc(books.createdAt))
		.limit(limit)
		.all()
		.map(toPublic);
}
