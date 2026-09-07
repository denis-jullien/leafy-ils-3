import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { returnToLender } from '$lib/server/deposits';
import { apiError, readJson } from '$lib/server/api';

/** POST /api/deposits/:id/return { barcode } → the book goes into the crate for the lender. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const { barcode } = await readJson<{ barcode?: unknown }>(request);
		if (typeof barcode !== 'string' || !barcode.trim())
			return json({ error: 'Code-barres manquant' }, { status: 400 });
		return json(returnToLender(db, Number(params.id), barcode, locals.user?.id));
	} catch (err) {
		if (err instanceof TypeError) return json({ error: err.message }, { status: 400 });
		return apiError(err);
	}
};
