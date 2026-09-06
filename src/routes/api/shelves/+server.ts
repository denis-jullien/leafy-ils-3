import { json } from '@sveltejs/kit';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { listShelves } from '$lib/server/shelves';

const EXAMPLES_PER_SHELF = 15;

/**
 * GET /api/shelves → shelves with their rules and description, plus a sample of
 * books already shelved, for the local embedding classifier in the browser.
 */
export const GET: RequestHandler = () => {
	const shelves = listShelves(db);
	const examples = shelves.flatMap((s) =>
		db
			.select({ title: books.title, authors: books.authors, description: books.description })
			.from(books)
			// Title-only rows look alike whatever the shelf; only summarised books are useful examples.
			.where(
				and(
					eq(books.shelfId, s.id),
					isNotNull(books.description),
					sql`length(${books.description}) > 80`
				)
			)
			.orderBy(desc(books.updatedAt))
			.limit(EXAMPLES_PER_SHELF)
			.all()
			.map((b) => ({
				shelfId: s.id,
				text: [b.title, b.authors, b.description?.slice(0, 300)].filter(Boolean).join('. ')
			}))
	);
	return json({
		shelves: shelves.map((s) => ({
			id: s.id,
			name: s.name,
			description: s.description,
			keywords: s.keywords
		})),
		examples
	});
};
