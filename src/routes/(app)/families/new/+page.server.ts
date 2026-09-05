import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { createFamily } from '$lib/server/families';
import { familySchema } from '$lib/schemas';

export const load: PageServerLoad = async () => ({
	form: await superValidate({ status: 'active' }, zod4(familySchema), { errors: false })
});

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event, zod4(familySchema));
		if (!form.valid) return fail(400, { form });
		const family = createFamily(db, form.data);
		redirect(303, `/families/${family.id}`);
	}
};
