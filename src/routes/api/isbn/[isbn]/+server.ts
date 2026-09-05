import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseIsbn } from '$lib/isbn';
import { lookupIsbn } from '$lib/server/metadata';

/** GET /api/isbn/9782070368228 → book metadata from the first provider that knows it. */
export const GET: RequestHandler = async ({ params }) => {
	const isbn13 = parseIsbn(params.isbn);
	if (!isbn13) error(400, 'Not a valid ISBN');
	const meta = await lookupIsbn(isbn13);
	if (!meta) error(404, 'No record found for this ISBN');
	return json(meta);
};
