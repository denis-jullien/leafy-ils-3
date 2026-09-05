import { error, fail, redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, families, loans } from '$lib/server/db/schema';
import { DuplicateBookError, updateBook } from '$lib/server/books';
import { bookSchema } from '$lib/schemas';

const loadBook = (id: string) => {
	const n = Number(id);
	const book = Number.isInteger(n)
		? db.select().from(books).where(eq(books.id, n)).get()
		: undefined;
	if (!book) error(404, 'Book not found');
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
	return { book, history, form };
};

export const actions: Actions = {
	save: async (event) => {
		const book = loadBook(event.params.id);
		const form = await superValidate(event, zod4(bookSchema));
		if (!form.valid) return fail(400, { form });
		try {
			updateBook(db, book.id, form.data);
		} catch (err) {
			if (err instanceof DuplicateBookError) {
				const field = err.field === 'isbn13' ? 'isbn' : 'rfidUid';
				return setError(
					form,
					field,
					`Already used by "${err.existing.title}" (#${err.existing.id})`
				);
			}
			if (err instanceof Error) return message(form, err.message, { status: 500 });
			throw err;
		}
		return message(form, 'Saved');
	},
	delete: async (event) => {
		const book = loadBook(event.params.id);
		const hasLoans = db.select({ id: loans.id }).from(loans).where(eq(loans.bookId, book.id)).get();
		if (hasLoans)
			return fail(409, { error: 'This book has loan history. Mark it withdrawn instead.' });
		db.delete(books).where(eq(books.id, book.id)).run();
		redirect(303, '/books');
	}
};
