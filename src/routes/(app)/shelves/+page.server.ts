import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	createShelf,
	deleteShelf,
	listShelvesWithCounts,
	moveShelf,
	proposeShelf,
	updateShelf
} from '$lib/server/shelves';
import { lookupIsbn } from '$lib/server/metadata';
import { parseIsbn } from '$lib/isbn';
import { shelfSchema } from '$lib/schemas';

export const load: PageServerLoad = async () => ({
	shelves: listShelvesWithCounts(db),
	form: await superValidate(zod4(shelfSchema))
});

const readShelf = async (request: Request) => {
	const fd = await request.formData();
	return {
		id: Number(fd.get('id')),
		name: String(fd.get('name') ?? '').trim(),
		keywords: String(fd.get('keywords') ?? '').trim() || null,
		dewey: String(fd.get('dewey') ?? '').trim() || null
	};
};

export const actions: Actions = {
	create: async (event) => {
		const form = await superValidate(event, zod4(shelfSchema));
		if (!form.valid) return fail(400, { form });
		try {
			createShelf(db, form.data);
		} catch {
			return message(form, 'Un rayon porte déjà ce nom.', { status: 400 });
		}
		return message(form, 'Rayon ajouté');
	},
	save: async ({ request }) => {
		const s = await readShelf(request);
		if (!s.name) return fail(400, { error: 'Le nom est obligatoire.' });
		try {
			updateShelf(db, s.id, { name: s.name, keywords: s.keywords, dewey: s.dewey });
		} catch {
			return fail(400, { error: 'Un rayon porte déjà ce nom.' });
		}
		return { saved: s.id };
	},
	move: async ({ request }) => {
		const fd = await request.formData();
		moveShelf(db, Number(fd.get('id')), fd.get('dir') === 'up' ? 'up' : 'down');
		return { ok: true };
	},
	remove: async ({ request }) => {
		const fd = await request.formData();
		deleteShelf(db, Number(fd.get('id')));
		return { ok: true };
	},
	/** Try the rules against a real record, to tune keywords and Dewey ranges. */
	test: async ({ request }) => {
		const fd = await request.formData();
		const isbn = parseIsbn(String(fd.get('isbn') ?? ''));
		if (!isbn) return fail(400, { test: { error: 'ISBN invalide' } });
		const meta = await lookupIsbn(isbn);
		if (!meta) return fail(404, { test: { error: 'Aucune notice trouvée' } });
		const match = proposeShelf(db, meta);
		return {
			test: {
				isbn,
				title: meta.title,
				subjects: meta.subjects,
				dewey: meta.dewey,
				shelf: match?.shelf.name ?? null,
				reason: match?.reason ?? null
			}
		};
	}
};
