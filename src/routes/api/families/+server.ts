import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { searchFamilies } from '$lib/server/families';

/** GET /api/families?q=dup → families whose name contains the text, with their open-loan count. */
export const GET: RequestHandler = ({ url }) =>
	json(searchFamilies(db, url.searchParams.get('q') ?? ''));
