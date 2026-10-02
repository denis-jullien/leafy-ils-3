import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { cataloguePage, cataloguePageHref } from '$lib/server/catalogue';

/** Keep responses bounded while allowing visitors to browse every matching book. */
const PAGE_SIZE = 120;

export const load: PageServerLoad = ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const rayon = Number(url.searchParams.get('rayon')) || null;
	const result = cataloguePage(
		db,
		{ q, shelfId: rayon, page: Number(url.searchParams.get('page')) },
		PAGE_SIZE
	);
	return {
		q,
		rayon,
		...result,
		previousHref: result.page > 1 ? cataloguePageHref(url, result.page - 1) : null,
		nextHref: result.page < result.pages ? cataloguePageHref(url, result.page + 1) : null
	};
};
