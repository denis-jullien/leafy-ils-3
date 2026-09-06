import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { families } from '$lib/server/db/schema';
import { familyQuickSchema } from '$lib/schemas';
import { readJson } from '$lib/server/api';

/** PATCH /api/families/:id { phone | status } → quick edits from the list. */
export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = Number(params.id);
	const family = db.select().from(families).where(eq(families.id, id)).get();
	if (!family) return json({ error: 'Famille introuvable' }, { status: 404 });
	let body: unknown;
	try {
		body = await readJson(request);
	} catch (err) {
		return json({ error: (err as Error).message }, { status: 400 });
	}
	const parsed = familyQuickSchema.safeParse(body);
	if (!parsed.success)
		return json({ error: parsed.error.issues[0]?.message ?? 'Valeur invalide' }, { status: 400 });
	if (Object.keys(parsed.data).length === 0)
		return json({ error: 'Rien à modifier' }, { status: 400 });
	const updated = db.update(families).set(parsed.data).where(eq(families.id, id)).returning().get();
	return json({ family: updated });
};
