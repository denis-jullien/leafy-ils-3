import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { parseIsbn } from '$lib/isbn';
import { lookupIsbn } from '$lib/server/metadata';
import { proposeShelf } from '$lib/server/shelves';

/**
 * GET /api/isbn/9782070368228 → merged record, verified cover, and the shelf the
 * rules propose from the record's subjects and class numbers.
 */
export const GET: RequestHandler = async ({ params }) => {
	const isbn13 = parseIsbn(params.isbn);
	if (!isbn13) error(400, 'ISBN invalide');
	const meta = await lookupIsbn(isbn13);
	if (!meta) error(404, 'Aucune notice trouvée pour cet ISBN');
	const match = proposeShelf(db, meta);
	return json({
		...meta,
		suggestedShelf: match
			? { id: match.shelf.id, name: match.shelf.name, reason: match.reason }
			: null
	});
};
