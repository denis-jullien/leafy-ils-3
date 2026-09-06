import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { bookQuickSchema } from '$lib/schemas';
import { readJson } from '$lib/server/api';

/** PATCH /api/books/:id { shelf | category | featured | status } → quick edits from the list. */
export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = Number(params.id);
	const book = db.select().from(books).where(eq(books.id, id)).get();
	if (!book) return json({ error: 'Livre introuvable' }, { status: 404 });
	let body: unknown;
	try {
		body = await readJson(request);
	} catch (err) {
		return json({ error: (err as Error).message }, { status: 400 });
	}
	const parsed = bookQuickSchema.safeParse(body);
	if (!parsed.success)
		return json({ error: parsed.error.issues[0]?.message ?? 'Valeur invalide' }, { status: 400 });
	if (Object.keys(parsed.data).length === 0)
		return json({ error: 'Rien à modifier' }, { status: 400 });
	const updated = db.update(books).set(parsed.data).where(eq(books.id, id)).returning().get();
	return json({ book: updated });
};
