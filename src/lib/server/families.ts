import { asc, eq, like, sql } from 'drizzle-orm';
import { squash } from '$lib/search';
import type { z } from 'zod';
import type { Db } from './db/client';
import { families, loans, type Family } from './db/schema';
import { familyBarcode } from '$lib/barcodes';
import type { familySchema } from '$lib/schemas';

export type FamilyInput = z.infer<typeof familySchema>;

export function createFamily(db: Db, input: FamilyInput): Family {
	return db.transaction((tx) => {
		const inserted = tx.insert(families).values(input).returning().get();
		return tx
			.update(families)
			.set({ barcode: familyBarcode(inserted.id) })
			.where(eq(families.id, inserted.id))
			.returning()
			.get();
	});
}

export function updateFamily(db: Db, id: number, input: FamilyInput): Family {
	return db.update(families).set(input).where(eq(families.id, id)).returning().get();
}

export interface FamilyHit {
	id: number;
	name: string;
	barcode: string | null;
	phone: string | null;
	status: Family['status'];
	openCount: number;
}

/** Name search for the circulation screen: "dup" finds "Famille Dupont". */
export function searchFamilies(db: Db, q: string, limit = 8): FamilyHit[] {
	const term = q.trim();
	if (!term) return [];
	return db
		.select({
			id: families.id,
			name: families.name,
			barcode: families.barcode,
			phone: families.phone,
			status: families.status,
			openCount: sql<number>`count(${loans.id})`
		})
		.from(families)
		.leftJoin(loans, sql`${loans.familyId} = ${families.id} AND ${loans.returnedAt} IS NULL`)
		.where(like(sql`squash(${families.name})`, `%${squash(term)}%`))
		.groupBy(families.id)
		.orderBy(asc(families.name))
		.limit(limit)
		.all();
}
