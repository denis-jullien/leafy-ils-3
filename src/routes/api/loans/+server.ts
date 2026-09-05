import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { checkout } from '$lib/server/circulation';
import { apiError, readJson } from '$lib/server/api';

/** POST /api/loans { familyId, bookIds[] } → the created loans. All or nothing. */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await readJson<{ familyId: number; bookIds: number[] }>(request);
		if (
			!Number.isInteger(body.familyId) ||
			!Array.isArray(body.bookIds) ||
			body.bookIds.length === 0
		)
			return json({ error: 'familyId and bookIds are required' }, { status: 400 });
		const loans = checkout(db, {
			familyId: body.familyId,
			bookIds: body.bookIds.map(Number),
			userId: locals.user?.id
		});
		return json({ loans }, { status: 201 });
	} catch (err) {
		if (err instanceof TypeError) return json({ error: err.message }, { status: 400 });
		return apiError(err);
	}
};
