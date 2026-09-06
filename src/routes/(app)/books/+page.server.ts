import { and, asc, count, desc, eq, isNotNull, isNull, like, or, sql, type SQL } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, loans } from '$lib/server/db/schema';
import { parseIsbn } from '$lib/isbn';
import { fillMissingCovers } from '$lib/server/covers';
import { CATEGORY_IDS, type CategoryId } from '$lib/config';
import { PAGE_SIZE, parseListing } from '$lib/listing';
import { ETAT_OPTIONS } from '$lib/labels';

const SORTS = ['title', 'authors', 'year', 'shelf', 'category', 'status', 'added'] as const;
type Sort = (typeof SORTS)[number];

type Etat = (typeof ETAT_OPTIONS)[number]['value'];

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

const text = (url: URL, key: string) => url.searchParams.get(key)?.trim() ?? '';

export const load: PageServerLoad = async ({ url }) => {
	const listing = parseListing(url, SORTS, 'added', 'desc');
	const f = {
		title: text(url, 't'),
		authors: text(url, 'a'),
		year: text(url, 'y'),
		shelf: text(url, 'r'),
		cat: ((v) => ((CATEGORY_IDS as readonly string[]).includes(v) ? (v as CategoryId) : ''))(
			text(url, 'cat')
		),
		coeur: text(url, 'coeur') === 'oui' ? 'oui' : '',
		etat: ((v) => (ETAT_OPTIONS.some((o) => o.value === v) ? (v as Etat) : ''))(text(url, 'etat')),
		couv: text(url, 'couv') === 'sans' ? 'sans' : ''
	};

	const filters: SQL[] = [];
	if (f.title) {
		const isbn = parseIsbn(f.title);
		filters.push(
			isbn
				? eq(books.isbn13, isbn)
				: or(like(books.title, `%${f.title}%`), like(books.barcode, `%${f.title}%`))!
		);
	}
	if (f.authors) filters.push(like(books.authors, `%${f.authors}%`));
	if (f.year) filters.push(like(sql`cast(${books.publishedYear} as text)`, `${f.year}%`));
	if (f.shelf) filters.push(like(books.shelf, `%${f.shelf}%`));
	if (f.cat) filters.push(eq(books.category, f.cat));
	if (f.coeur) filters.push(eq(books.featured, true));
	if (f.etat === 'dispo') filters.push(and(eq(books.status, 'active'), isNull(loans.id))!);
	else if (f.etat === 'pret') filters.push(isNotNull(loans.id));
	else if (f.etat) filters.push(eq(books.status, f.etat));
	if (f.couv) filters.push(or(isNull(books.coverUrl), eq(books.coverUrl, ''))!);
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

	return {
		...listing,
		filters: f,
		hasFilters: Object.values(f).some(Boolean),
		rows,
		total,
		missingCovers
	};
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
