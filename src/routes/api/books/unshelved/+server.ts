import { json } from '@sveltejs/kit';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';

/** GET /api/books/unshelved → active books without a shelf, for the batch classifier. */
export const GET: RequestHandler = ({ url }) => {
	const limit = Math.min(1000, Number(url.searchParams.get('limit')) || 500);
	const rows = db
		.select({
			id: books.id,
			title: books.title,
			authors: books.authors,
			publisher: books.publisher,
			description: books.description
		})
		.from(books)
		.where(and(isNull(books.shelfId), eq(books.status, 'active')))
		.orderBy(asc(books.title))
		.limit(limit)
		.all();
	return json({ books: rows });
};
