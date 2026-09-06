import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { searchCatalogue } from '$lib/server/catalogue';

/** How many books a page shows: enough for any search, a first slice of the whole. */
const PAGE_SIZE = 120;

export const load: PageServerLoad = ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const rayon = Number(url.searchParams.get('rayon')) || null;
	const books = searchCatalogue(db, { q, shelfId: rayon, limit: PAGE_SIZE + 1 });
	return {
		q,
		rayon,
		books: books.slice(0, PAGE_SIZE),
		truncated: books.length > PAGE_SIZE,
		pageSize: PAGE_SIZE
	};
};
