import { asc, count, like, or, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { families, loans } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const pattern = `%${q}%`;
	const rows = await db
		.select({
			family: families,
			open: count(loans.id)
		})
		.from(families)
		.leftJoin(loans, sql`${loans.familyId} = ${families.id} AND ${loans.returnedAt} IS NULL`)
		.where(q ? or(like(families.name, pattern), like(families.email, pattern)) : undefined)
		.groupBy(families.id)
		.orderBy(asc(families.name))
		.limit(300);
	return { q, rows };
};
