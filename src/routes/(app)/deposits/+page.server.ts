import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { createDeposit, defaultDepositLabel, listDeposits, plusMonths } from '$lib/server/deposits';
import { todayIso } from '$lib/server/events';
import { depositSchema } from '$lib/schemas';
import { DEPOSIT_MONTHS } from '$lib/config';

export const load: PageServerLoad = async () => {
	const today = todayIso();
	return {
		deposits: listDeposits(db),
		today,
		form: await superValidate(
			{
				label: defaultDepositLabel(today),
				receivedOn: today,
				returnOn: plusMonths(today, DEPOSIT_MONTHS)
			},
			zod4(depositSchema),
			{ errors: false }
		)
	};
};

export const actions: Actions = {
	create: async (event) => {
		const form = await superValidate(event, zod4(depositSchema));
		if (!form.valid) return fail(400, { form });
		const dep = createDeposit(db, form.data);
		redirect(303, `/deposits/${dep.id}`);
	}
};
