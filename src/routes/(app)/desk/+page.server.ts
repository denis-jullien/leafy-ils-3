import { and, count, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, families, loans } from '$lib/server/db/schema';
import { overdueLoans } from '$lib/server/circulation';

export const load: PageServerLoad = async () => {
	const [[b], [f], [l]] = await Promise.all([
		db.select({ n: count() }).from(books).where(eq(books.status, 'active')),
		db.select({ n: count() }).from(families).where(eq(families.status, 'active')),
		db
			.select({ n: count() })
			.from(loans)
			.where(and(isNull(loans.returnedAt)))
	]);
	return {
		stats: { books: b.n, families: f.n, onLoan: l.n },
		overdue: overdueLoans(db).slice(0, 50)
	};
};
