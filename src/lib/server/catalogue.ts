import { and, asc, desc, eq, like, or, sql, type SQL } from 'drizzle-orm';
import { FUZZY_THRESHOLD, fuzzyScore, squash, squashedWords } from '$lib/search';
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
	/** When nothing matches, look for near misses (typos). Off for automatic rails. */
	fuzzy?: boolean;
}

const shelfFilter = (shelfId: number | null | undefined): SQL | undefined =>
	shelfId == null ? undefined : eq(books.shelfId, shelfId);

/** Title, authors and publisher squashed into one loose-matching key, in SQL. */
const searchKey = sql`squash(${books.title} || ' ' || coalesce(${books.authors}, '') || ' ' || coalesce(${books.publisher}, ''))`;

/**
 * Loose match: the whole query squashed ("d. gray" → "dgray" finds "D.Gray-man"),
 * or every word of it somewhere in the key ("potter école" finds the Harry Potter).
 */
function looseMatch(term: string): SQL {
	const whole = squash(term);
	const words = squashedWords(term);
	const each = words.map((w) => like(searchKey, `%${w}%`));
	return words.length > 1 ? or(like(searchKey, `%${whole}%`), and(...each)!)! : each[0];
}

/** Sort key: title starts with the query, title contains it, then authors, then the rest. */
function rank(term: string, b: { title: string; authors: string | null }): number {
	const q = squash(term);
	const words = squashedWords(term);
	const title = squash(b.title);
	const authors = squash(b.authors ?? '');
	if (title.startsWith(q)) return 0;
	if (title.includes(q)) return 1;
	if (words.every((w) => title.includes(w))) return 2;
	if (authors.includes(q) || words.every((w) => authors.includes(w))) return 3;
	return 4;
}

function selectPublic(db: Db) {
	return db
		.select(publicColumns)
		.from(books)
		.leftJoin(loans, onLoanJoin)
		.leftJoin(shelves, eq(shelves.id, books.shelfId));
}

/**
 * Public catalogue search: title, author or publisher, loosely matched (case,
 * accents, punctuation and spacing ignored), or an exact ISBN, optionally within
 * one shelf. Empty query + shelf lists that shelf. When nothing matches, the
 * closest titles and authors within one or two typos are offered instead.
 */
export function searchCatalogue(
	db: Db,
	{ q = '', shelfId = null, limit = 60, fuzzy = true }: CatalogueQuery
): PublicBook[] {
	const term = q.trim();
	const filters: SQL[] = [eq(books.status, 'active')];
	const byShelf = shelfFilter(shelfId);
	if (byShelf) filters.push(byShelf);
	if (!term) {
		return selectPublic(db)
			.where(and(...filters))
			.orderBy(asc(books.title))
			.limit(limit)
			.all()
			.map(toPublic);
	}

	const isbn = parseIsbn(term);
	if (isbn) {
		return selectPublic(db)
			.where(and(...filters, eq(books.isbn13, isbn)))
			.all()
			.map(toPublic);
	}

	const hits = selectPublic(db)
		.where(and(...filters, looseMatch(term)))
		.orderBy(asc(books.title))
		.limit(limit)
		.all()
		.map(toPublic);
	if (hits.length || !fuzzy || squash(term).length < 3) {
		return hits.sort((a, b) => rank(term, a) - rank(term, b));
	}

	// Nothing exact: score every book of the shelf (a few thousand short strings,
	// milliseconds) and keep the near misses.
	return selectPublic(db)
		.where(and(...filters))
		.all()
		.map((r) => ({ book: toPublic(r), score: fuzzyScore(term, `${r.title} ${r.authors ?? ''}`) }))
		.filter((x) => x.score >= FUZZY_THRESHOLD)
		.sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title, 'fr'))
		.slice(0, limit)
		.map((x) => x.book);
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

/** The welcome rail: the volunteers' picks and nothing else, newest pick first. */
export function featuredBooks(db: Db, shelfId: number | null = null, limit = 12): PublicBook[] {
	return db
		.select(publicColumns)
		.from(books)
		.leftJoin(loans, onLoanJoin)
		.leftJoin(shelves, eq(shelves.id, books.shelfId))
		.where(and(eq(books.status, 'active'), eq(books.featured, true), shelfFilter(shelfId)))
		.orderBy(desc(books.updatedAt), desc(books.createdAt))
		.limit(limit)
		.all()
		.map(toPublic);
}
