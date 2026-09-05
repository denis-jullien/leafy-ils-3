import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from './db/client';
import { families, type Family } from './db/schema';
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
