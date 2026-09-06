import { fail, redirect } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { createBook, DuplicateBookError } from '$lib/server/books';
import { applyCoverFromForm } from '$lib/server/book-cover-actions';
import { CoverError } from '$lib/server/cover-store';
import { bookSchema } from '$lib/schemas';
import { listShelves } from '$lib/server/shelves';

export const load: PageServerLoad = async ({ url }) => {
	// /books/new?isbn=978... lets the circulation page hand over an unknown scan.
	const isbn = url.searchParams.get('isbn') ?? '';
	return {
		form: await superValidate({ isbn, status: 'active' }, zod4(bookSchema), { errors: false }),
		shelves: listShelves(db).map((s) => ({ id: s.id, name: s.name }))
	};
};

export const actions: Actions = {
	default: async (event) => {
		const fd = await event.request.formData();
		const form = await superValidate(fd, zod4(bookSchema));
		if (!form.valid) return fail(400, { form });
		let book;
		try {
			book = createBook(db, form.data);
		} catch (err) {
			if (err instanceof DuplicateBookError) {
				return setError(
					form,
					'isbn',
					`Déjà au catalogue : « ${err.existing.title} » (n° ${err.existing.id})`
				);
			}
			if (err instanceof Error) return message(form, err.message, { status: 500 });
			throw err;
		}
		try {
			await applyCoverFromForm(db, book.id, fd, form.data.coverUrl);
		} catch (err) {
			// The book exists; the cover can be fixed from its page.
			if (!(err instanceof CoverError)) throw err;
		}
		redirect(303, `/books/${book.id}`);
	}
};
