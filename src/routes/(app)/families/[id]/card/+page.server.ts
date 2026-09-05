import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { families } from '$lib/server/db/schema';

export const load: PageServerLoad = ({ params }) => {
	const family = db
		.select()
		.from(families)
		.where(eq(families.id, Number(params.id)))
		.get();
	if (!family?.barcode) error(404, 'Famille introuvable');
	return { family: { name: family.name, barcode: family.barcode } };
};
