import { fail, redirect } from '@sveltejs/kit';
import { count } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { setupSchema } from '$lib/schemas';

async function alreadySetUp() {
	const [row] = await db.select({ n: count() }).from(user);
	return (row?.n ?? 0) > 0;
}

/** One-time page: creates the first account, which becomes the administrator. */
export const load: PageServerLoad = async () => {
	if (await alreadySetUp()) redirect(303, '/login');
	return { form: await superValidate(zod4(setupSchema)) };
};

export const actions: Actions = {
	default: async (event) => {
		if (await alreadySetUp()) redirect(303, '/login');
		const form = await superValidate(event, zod4(setupSchema));
		if (!form.valid) return fail(400, { form });
		try {
			await auth.api.signUpEmail({
				body: { name: form.data.name, email: form.data.email, password: form.data.password },
				headers: event.request.headers
			});
		} catch (err) {
			if (err instanceof APIError) return message(form, err.message, { status: 400 });
			throw err;
		}
		redirect(303, '/desk');
	}
};
