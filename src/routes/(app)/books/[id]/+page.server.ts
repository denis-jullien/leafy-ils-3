import { error, fail, redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, families, loans } from '$lib/server/db/schema';
import { DuplicateBookError, updateBook } from '$lib/server/books';
import { applyCoverFromForm } from '$lib/server/book-cover-actions';
import { CoverError } from '$lib/server/cover-store';
import { bookSchema } from '$lib/schemas';
import { listShelves } from '$lib/server/shelves';

const loadBook = (id: string) => {
	const n = Number(id);
	const book = Number.isInteger(n)
		? db.select().from(books).where(eq(books.id, n)).get()
		: undefined;
	if (!book) error(404, 'Livre introuvable');
	return book;
};

export const load: PageServerLoad = async ({ params }) => {
	const book = loadBook(params.id);
	const history = db
		.select({ loan: loans, family: families })
		.from(loans)
		.innerJoin(families, eq(families.id, loans.familyId))
		.where(eq(loans.bookId, book.id))
		.orderBy(desc(loans.checkedOutAt))
		.limit(20)
		.all();
	const form = await superValidate({ ...book, isbn: book.isbn13 ?? '' }, zod4(bookSchema), {
		errors: false
	});
	return { book, history, form, shelves: listShelves(db).map((s) => ({ id: s.id, name: s.name })) };
};

export const actions: Actions = {
	save: async (event) => {
		const book = loadBook(event.params.id);
		const fd = await event.request.formData();
		const form = await superValidate(fd, zod4(bookSchema));
		if (!form.valid) return fail(400, { form });
		try {
			updateBook(db, book.id, form.data);
		} catch (err) {
			if (err instanceof DuplicateBookError) {
				return setError(
					form,
					'isbn',
					`Déjà utilisé par « ${err.existing.title} » (n° ${err.existing.id})`
				);
			}
			if (err instanceof Error) return message(form, err.message, { status: 500 });
			throw err;
		}
		let coverNote: string | null;
		try {
			coverNote = await applyCoverFromForm(db, book.id, fd, form.data.coverUrl);
		} catch (err) {
			if (!(err instanceof CoverError)) throw err;
			return message(form, err.message, { status: 400 });
		}
		// Reflect the stored cover in the form the client keeps.
		const fresh = loadBook(event.params.id);
		form.data.coverUrl = fresh.coverUrl ?? '';
		return message(form, coverNote ? `Enregistré · ${coverNote}` : 'Enregistré');
	},
	delete: async (event) => {
		const book = loadBook(event.params.id);
		const hasLoans = db.select({ id: loans.id }).from(loans).where(eq(loans.bookId, book.id)).get();
		if (hasLoans)
			return fail(409, {
				error: 'Ce livre a un historique de prêts. Marquez-le plutôt comme retiré.'
			});
		db.delete(books).where(eq(books.id, book.id)).run();
		redirect(303, '/books');
	}
};
