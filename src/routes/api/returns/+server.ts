import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { returnLoans } from '$lib/server/circulation';
import { apiError, readJson } from '$lib/server/api';

/** POST /api/returns { loanIds[] } → closes those loans together. All or nothing. */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await readJson<{ loanIds: number[] }>(request);
		if (!Array.isArray(body.loanIds) || body.loanIds.length === 0)
			return json({ error: 'loanIds est obligatoire' }, { status: 400 });
		const loans = returnLoans(db, body.loanIds.map(Number), locals.user?.id);
		return json({ loans });
	} catch (err) {
		if (err instanceof TypeError) return json({ error: err.message }, { status: 400 });
		return apiError(err);
	}
};
