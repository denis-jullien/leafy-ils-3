import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { createEvent, deleteEvent, listEvents, todayIso } from '$lib/server/events';
import { eventSchema } from '$lib/schemas';

export const load: PageServerLoad = async () => ({
	events: listEvents(db),
	today: todayIso(),
	form: await superValidate({ free: true }, zod4(eventSchema), { errors: false })
});

export const actions: Actions = {
	create: async (event) => {
		const form = await superValidate(event, zod4(eventSchema));
		if (!form.valid) return fail(400, { form });
		createEvent(db, form.data);
		return message(form, 'Événement ajouté');
	},
	delete: async (event) => {
		const id = Number((await event.request.formData()).get('id'));
		deleteEvent(db, id);
		return { ok: true };
	}
};
