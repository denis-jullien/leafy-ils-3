import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { volunteerSchema } from '$lib/schemas';

export const load: PageServerLoad = async ({ request }) => {
	const { users } = await auth.api.listUsers({
		query: { limit: 200, sortBy: 'name' },
		headers: request.headers
	});
	return {
		users: users.map((u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			role: (u.role === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
			banned: !!u.banned
		})),
		form: await superValidate({ role: 'user' }, zod4(volunteerSchema), { errors: false })
	};
};

export const actions: Actions = {
	create: async (event) => {
		const form = await superValidate(event, zod4(volunteerSchema));
		if (!form.valid) return fail(400, { form });
		try {
			await auth.api.createUser({
				body: { ...form.data },
				headers: event.request.headers
			});
		} catch (err) {
			if (err instanceof APIError) return message(form, err.message, { status: 400 });
			throw err;
		}
		return message(form, `Compte créé pour ${form.data.name}`);
	},
	remove: async (event) => {
		const userId = String((await event.request.formData()).get('userId'));
		if (userId === event.locals.user?.id)
			return fail(400, { error: 'Vous ne pouvez pas supprimer votre propre compte.' });
		try {
			await auth.api.removeUser({ body: { userId }, headers: event.request.headers });
		} catch (err) {
			if (err instanceof APIError) return fail(400, { error: err.message });
			throw err;
		}
		return { ok: true };
	},
	setRole: async (event) => {
		const fd = await event.request.formData();
		const userId = String(fd.get('userId'));
		const role = String(fd.get('role')) === 'admin' ? 'admin' : 'user';
		if (userId === event.locals.user?.id)
			return fail(400, { error: 'Demandez à un autre administrateur de changer votre rôle.' });
		try {
			await auth.api.setRole({ body: { userId, role }, headers: event.request.headers });
		} catch (err) {
			if (err instanceof APIError) return fail(400, { error: err.message });
			throw err;
		}
		return { ok: true };
	}
};
