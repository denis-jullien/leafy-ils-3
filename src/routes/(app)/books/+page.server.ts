import { and, asc, count, desc, eq, isNotNull, isNull, like, or, sql, type SQL } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, loans } from '$lib/server/db/schema';
import { parseIsbn } from '$lib/isbn';
import { fillMissingCovers } from '$lib/server/covers';
import { CATEGORY_IDS, type CategoryId } from '$lib/config';
import { BOOK_STATUS } from '$lib/labels';
import { PAGE_SIZE, parseListing } from '$lib/listing';

const SORTS = ['title', 'authors', 'year', 'shelf', 'category', 'status', 'added'] as const;
type Sort = (typeof SORTS)[number];

const onLoan = sql`${loans.bookId} = ${books.id} AND ${loans.returnedAt} IS NULL`;
const nocase = (col: SQL | (typeof books)[keyof typeof books]) => sql`${col} COLLATE NOCASE`;

/** Text columns sort case-insensitively, with empty values last whatever the direction. */
const ORDER: Record<Sort, (dir: 'asc' | 'desc') => SQL[]> = {
	title: (d) => [d === 'asc' ? asc(nocase(books.title)) : desc(nocase(books.title))],
	authors: (d) => [
		sql`${books.authors} IS NULL`,
		d === 'asc' ? asc(nocase(books.authors)) : desc(nocase(books.authors))
	],
	year: (d) => [
		sql`${books.publishedYear} IS NULL`,
		d === 'asc' ? asc(books.publishedYear) : desc(books.publishedYear)
	],
	shelf: (d) => [
		sql`${books.shelf} IS NULL`,
		d === 'asc' ? asc(nocase(books.shelf)) : desc(nocase(books.shelf))
	],
	category: (d) => [
		sql`${books.category} IS NULL`,
		d === 'asc' ? asc(books.category) : desc(books.category)
	],
	// available first when ascending: active books without an open loan, then on loan, then lost/withdrawn
	status: (d) => {
		const rank = sql`CASE WHEN ${books.status} != 'active' THEN 2 WHEN ${loans.id} IS NOT NULL THEN 1 ELSE 0 END`;
		return [d === 'asc' ? asc(rank) : desc(rank), asc(loans.dueAt)];
	},
	added: (d) => [d === 'asc' ? asc(books.createdAt) : desc(books.createdAt)]
};

export const load: PageServerLoad = async ({ url }) => {
	const listing = parseListing(url, SORTS, 'added', 'desc');
	const catRaw = url.searchParams.get('cat') ?? '';
	const cat = (CATEGORY_IDS as readonly string[]).includes(catRaw) ? (catRaw as CategoryId) : '';
	const dispo = url.searchParams.get('dispo') ?? ''; // '', 'oui', 'non'
	const etatRaw = url.searchParams.get('etat') ?? '';
	const etat = etatRaw in BOOK_STATUS ? (etatRaw as keyof typeof BOOK_STATUS) : '';
	const couv = url.searchParams.get('couv') ?? ''; // '', 'sans'

	const filters: SQL[] = [];
	if (listing.q) {
		const isbn = parseIsbn(listing.q);
		const pattern = `%${listing.q}%`;
		filters.push(
			isbn
				? eq(books.isbn13, isbn)
				: or(
						like(books.title, pattern),
						like(books.authors, pattern),
						like(books.publisher, pattern),
						like(books.barcode, pattern)
					)!
		);
	}
	if (cat) filters.push(eq(books.category, cat));
	if (etat) filters.push(eq(books.status, etat));
	if (dispo === 'oui') filters.push(and(eq(books.status, 'active'), isNull(loans.id))!);
	if (dispo === 'non') filters.push(isNotNull(loans.id));
	if (couv === 'sans') filters.push(or(isNull(books.coverUrl), eq(books.coverUrl, ''))!);
	const where = filters.length ? and(...filters) : undefined;

	const total =
		db.select({ n: count() }).from(books).leftJoin(loans, onLoan).where(where).get()?.n ?? 0;
	const rows = db
		.select({ book: books, onLoanTo: loans.familyId, dueAt: loans.dueAt })
		.from(books)
		.leftJoin(loans, onLoan)
		.where(where)
		.orderBy(...ORDER[listing.sort](listing.dir), asc(nocase(books.title)))
		.limit(PAGE_SIZE)
		.offset((listing.page - 1) * PAGE_SIZE)
		.all();

	const missingCovers =
		db
			.select({ n: count() })
			.from(books)
			.where(and(isNotNull(books.isbn13), isNull(books.coverUrl), eq(books.status, 'active')))
			.get()?.n ?? 0;

	return { ...listing, filters: { cat, dispo, etat, couv }, rows, total, missingCovers };
};

export const actions: Actions = {
	/** Fetch covers (and fill empty details) for a batch of books that have none yet. */
	fillCovers: async () => {
		const r = await fillMissingCovers(db, 10);
		return {
			covers: `${r.filled} couverture(s) trouvée(s) sur ${r.tried} livre(s) examiné(s)${r.remaining ? `, ${r.remaining} restant(s)` : ''}.`
		};
	}
};
