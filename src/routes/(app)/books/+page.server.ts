import { desc, eq, like, or, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, loans } from '$lib/server/db/schema';
import { parseIsbn } from '$lib/isbn';

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

	return { q, rows };
};
