import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { getPublicBook, searchCatalogue } from '$lib/server/catalogue';

export const load: PageServerLoad = ({ params }) => {
	const id = Number(params.id);
	const book = Number.isInteger(id) ? getPublicBook(db, id) : null;
	if (!book) error(404, 'Ce livre ne fait pas partie du catalogue.');

	// A few other titles by the same first author, for the "voir aussi" rail.
	const firstAuthor = book.authors?.split(';')[0]?.trim();
	const related = firstAuthor
		? searchCatalogue(db, { q: firstAuthor, limit: 7, fuzzy: false })
				.filter((b) => b.id !== book.id)
				.slice(0, 6)
		: [];

	return { book, related, firstAuthor };
};
