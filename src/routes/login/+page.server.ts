import { fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { loginSchema } from '$lib/schemas';

const safeNext = (raw: string | null) =>
	raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/desk';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
	return { form: await superValidate(zod4(loginSchema)) };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event, zod4(loginSchema));
		if (!form.valid) return fail(400, { form });
		try {
			await auth.api.signInEmail({
				body: { email: form.data.email, password: form.data.password },
				headers: event.request.headers
			});
		} catch (err) {
			if (err instanceof APIError) return message(form, 'Wrong email or password', { status: 401 });
			throw err;
		}
		redirect(303, safeNext(event.url.searchParams.get('next')));
	}
};
