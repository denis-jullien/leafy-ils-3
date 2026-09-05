import { and, desc, eq, isNotNull, isNull, like, or, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, loans } from '$lib/server/db/schema';
import { parseIsbn } from '$lib/isbn';
import { fillMissingCovers } from '$lib/server/covers';

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const isbn = q ? parseIsbn(q) : null;
	const pattern = `%${q}%`;
	const where = q
		? isbn
			? eq(books.isbn13, isbn)
			: or(like(books.title, pattern), like(books.authors, pattern), like(books.barcode, pattern))
		: undefined;

	const rows = await db
		.select({
			book: books,
			onLoanTo: loans.familyId,
			dueAt: loans.dueAt
		})
		.from(books)
		.leftJoin(loans, sql`${loans.bookId} = ${books.id} AND ${loans.returnedAt} IS NULL`)
		.where(where)
		.orderBy(desc(books.createdAt))
		.limit(200);

	const missingCovers = db
		.select({ id: books.id })
		.from(books)
		.where(and(isNotNull(books.isbn13), isNull(books.coverUrl), eq(books.status, 'active')))
		.all().length;

	return { q, rows, missingCovers };
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
