import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { getCover } from '$lib/server/cover-store';

/**
 * GET /covers/:bookId?v=<hash> → the stored WebP. The URL carries the content
 * hash, so it can be cached for a year; a new image gets a new URL.
 */
export const GET: RequestHandler = ({ params, request }) => {
	const cover = getCover(db, Number(params.id));
	if (!cover) error(404, 'Pas de couverture');
	const etag = `"${cover.hash}"`;
	if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304 });
	return new Response(new Uint8Array(cover.bytes), {
		headers: {
			'content-type': cover.mime,
			'content-length': String(cover.bytes.length),
			'cache-control': 'public, max-age=31536000, immutable',
			etag
		}
	});
};
