import { error, fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { deleteEvent, getEvent, updateEvent } from '$lib/server/events';
import { eventSchema } from '$lib/schemas';

const loadEvent = (id: string) => {
	const n = Number(id);
	const e = Number.isInteger(n) ? getEvent(db, n) : undefined;
	if (!e) error(404, 'Événement introuvable');
	return e;
};

export const load: PageServerLoad = async ({ params }) => {
	const event = loadEvent(params.id);
	return { event, form: await superValidate(event, zod4(eventSchema), { errors: false }) };
};

export const actions: Actions = {
	save: async (event) => {
		const e = loadEvent(event.params.id);
		const form = await superValidate(event, zod4(eventSchema));
		if (!form.valid) return fail(400, { form });
		updateEvent(db, e.id, form.data);
		return message(form, 'Enregistré');
	},
	delete: async (event) => {
		const e = loadEvent(event.params.id);
		deleteEvent(db, e.id);
		redirect(303, '/events');
	}
};
