import { and, asc, count, desc, eq, like, sql, type SQL } from 'drizzle-orm';
import { squash } from '$lib/search';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { families, loans } from '$lib/server/db/schema';
import { FAMILY_STATUS } from '$lib/labels';
import { PAGE_SIZE, parseListing } from '$lib/listing';

const SORTS = ['name', 'contact', 'open', 'status', 'added'] as const;
type Sort = (typeof SORTS)[number];

const openLoans = sql<number>`count(${loans.id})`;
const nocase = (col: SQL | (typeof families)[keyof typeof families]) => sql`${col} COLLATE NOCASE`;

const ORDER: Record<Sort, (dir: 'asc' | 'desc') => SQL[]> = {
	name: (d) => [d === 'asc' ? asc(nocase(families.name)) : desc(nocase(families.name))],
	contact: (d) => [
		sql`${families.phone} IS NULL`,
		d === 'asc' ? asc(families.phone) : desc(families.phone)
	],
	open: (d) => [d === 'asc' ? asc(openLoans) : desc(openLoans)],
	status: (d) => [d === 'asc' ? asc(families.status) : desc(families.status)],
	added: (d) => [d === 'asc' ? asc(families.createdAt) : desc(families.createdAt)]
};

export const load: PageServerLoad = async ({ url }) => {
	const listing = parseListing(url, SORTS, 'name');
	const text = (key: string) => url.searchParams.get(key)?.trim() ?? '';
	const f = {
		name: text('n'),
		email: text('e'),
		phone: text('tel'),
		statut: ((v) => (v in FAMILY_STATUS ? (v as keyof typeof FAMILY_STATUS) : ('' as const)))(
			text('statut')
		),
		pret: text('pret') === 'oui' ? 'oui' : ''
	};

	const filters: SQL[] = [];
	if (f.name) filters.push(like(sql`squash(${families.name})`, `%${squash(f.name)}%`));
	if (f.email) filters.push(like(families.email, `%${f.email}%`));
	if (f.phone) filters.push(like(families.phone, `%${f.phone}%`));
	if (f.statut !== '') filters.push(eq(families.status, f.statut));
	const where = filters.length ? and(...filters) : undefined;
	const having = f.pret === 'oui' ? sql`count(${loans.id}) > 0` : undefined;

	const base = () =>
		db
			.select({ family: families, open: openLoans })
			.from(families)
			.leftJoin(loans, sql`${loans.familyId} = ${families.id} AND ${loans.returnedAt} IS NULL`)
			.where(where)
			.groupBy(families.id)
			.having(having);

	const total = db.select({ n: count() }).from(base().as('f')).get()?.n ?? 0;
	const rows = base()
		.orderBy(...ORDER[listing.sort](listing.dir), asc(nocase(families.name)))
		.limit(PAGE_SIZE)
		.offset((listing.page - 1) * PAGE_SIZE)
		.all();

	return { ...listing, filters: f, hasFilters: Object.values(f).some(Boolean), rows, total };
};
