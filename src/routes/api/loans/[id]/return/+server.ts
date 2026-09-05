import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { loans } from '$lib/server/db/schema';
import { returnBook } from '$lib/server/circulation';
import { apiError } from '$lib/server/api';

/** POST /api/loans/:id/return → closes the loan, whoever hands the book back. */
export const POST: RequestHandler = ({ params, locals }) => {
	const loan = db
		.select()
		.from(loans)
		.where(eq(loans.id, Number(params.id)))
		.get();
	if (!loan) return json({ error: 'Loan not found' }, { status: 404 });
	try {
		return json({ loan: returnBook(db, loan.bookId, locals.user?.id) });
	} catch (err) {
		return apiError(err);
	}
};
