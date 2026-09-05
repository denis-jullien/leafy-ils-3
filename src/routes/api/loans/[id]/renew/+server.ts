import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { renewLoan } from '$lib/server/circulation';
import { apiError } from '$lib/server/api';

/** POST /api/loans/:id/renew → pushes the due date out once more, within policy. */
export const POST: RequestHandler = ({ params }) => {
	try {
		return json({ loan: renewLoan(db, Number(params.id)) });
	} catch (err) {
		return apiError(err);
	}
};
