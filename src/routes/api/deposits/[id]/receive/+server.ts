import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { receiveBook } from '$lib/server/deposits';
import { apiError, readJson } from '$lib/server/api';

/** POST /api/deposits/:id/receive { barcode } → what that sticker means for this deposit. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const { barcode } = await readJson<{ barcode?: unknown }>(request);
		if (typeof barcode !== 'string' || !barcode.trim())
			return json({ error: 'Code-barres manquant' }, { status: 400 });
		return json(receiveBook(db, Number(params.id), barcode, locals.user?.id));
	} catch (err) {
		if (err instanceof TypeError) return json({ error: err.message }, { status: 400 });
		return apiError(err);
	}
};
