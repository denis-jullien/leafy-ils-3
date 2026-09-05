import { error, fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { families, members } from '$lib/server/db/schema';
import { updateFamily } from '$lib/server/families';
import {
	openLoansForFamily,
	renewLoan,
	returnBook,
	CirculationError
} from '$lib/server/circulation';
import { familySchema, memberSchema } from '$lib/schemas';

const loadFamily = (id: string) => {
	const n = Number(id);
	const family = Number.isInteger(n)
		? db.select().from(families).where(eq(families.id, n)).get()
		: undefined;
	if (!family) error(404, 'Family not found');
	return family;
};

export const load: PageServerLoad = async ({ params }) => {
	const family = loadFamily(params.id);
	return {
		family,
		members: db
			.select()
			.from(members)
			.where(eq(members.familyId, family.id))
			.orderBy(asc(members.name))
			.all(),
		loans: openLoansForFamily(db, family.id),
		form: await superValidate(family, zod4(familySchema), { errors: false }),
		memberForm: await superValidate(zod4(memberSchema))
	};
};

export const actions: Actions = {
	save: async (event) => {
		const family = loadFamily(event.params.id);
		const form = await superValidate(event, zod4(familySchema));
		if (!form.valid) return fail(400, { form });
		updateFamily(db, family.id, form.data);
		return message(form, 'Saved');
	},
	addMember: async (event) => {
		const family = loadFamily(event.params.id);
		const memberForm = await superValidate(event, zod4(memberSchema));
		if (!memberForm.valid) return fail(400, { memberForm });
		db.insert(members)
			.values({ ...memberForm.data, familyId: family.id })
			.run();
		return { memberForm };
	},
	removeMember: async (event) => {
		const family = loadFamily(event.params.id);
		const id = Number((await event.request.formData()).get('memberId'));
		db.delete(members).where(eq(members.id, id)).run();
		return { ok: true, familyId: family.id };
	},
	returnBook: async (event) => {
		loadFamily(event.params.id);
		const bookId = Number((await event.request.formData()).get('bookId'));
		try {
			returnBook(db, bookId, event.locals.user?.id);
		} catch (err) {
			if (err instanceof CirculationError) return fail(409, { error: err.message });
			throw err;
		}
		return { ok: true };
	},
	renew: async (event) => {
		loadFamily(event.params.id);
		const loanId = Number((await event.request.formData()).get('loanId'));
		try {
			renewLoan(db, loanId);
		} catch (err) {
			if (err instanceof CirculationError) return fail(409, { error: err.message });
			throw err;
		}
		return { ok: true };
	}
};
