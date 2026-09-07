import { error, fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	closeDeposit,
	compareWithList,
	deleteDeposit,
	depositBooks,
	depositLoanCap,
	DepositError,
	getDeposit,
	openDeposits,
	updateDeposit
} from '$lib/server/deposits';
import { depositSchema } from '$lib/schemas';

const loadDeposit = (id: string) => {
	const n = Number(id);
	const dep = Number.isInteger(n) ? getDeposit(db, n) : undefined;
	if (!dep) error(404, 'Dépôt introuvable');
	return dep;
};

export const load: PageServerLoad = async ({ params }) => {
	const deposit = loadDeposit(params.id);
	return {
		deposit,
		rows: depositBooks(db, deposit.id),
		others: openDeposits(db)
			.filter((d) => d.id !== deposit.id)
			.map((d) => ({ id: d.id, label: d.label, returnOn: d.returnOn })),
		loanCap: depositLoanCap(deposit),
		form: await superValidate(deposit, zod4(depositSchema), { errors: false })
	};
};

export const actions: Actions = {
	save: async (event) => {
		const deposit = loadDeposit(event.params.id);
		const form = await superValidate(event, zod4(depositSchema));
		if (!form.valid) return fail(400, { form });
		updateDeposit(db, deposit.id, form.data);
		return message(form, 'Enregistré');
	},
	/** The crate has gone: what is left moves to another open deposit. */
	close: async (event) => {
		const deposit = loadDeposit(event.params.id);
		const fd = await event.request.formData();
		const moveTo = fd.get('moveTo') ? Number(fd.get('moveTo')) : null;
		try {
			const r = closeDeposit(db, deposit.id, moveTo, event.locals.user?.id);
			return { closed: r.moved };
		} catch (err) {
			if (err instanceof DepositError) return fail(409, { error: err.message });
			throw err;
		}
	},
	compare: async (event) => {
		const deposit = loadDeposit(event.params.id);
		const fd = await event.request.formData();
		const text = String(fd.get('list') ?? '');
		if (!text.trim()) return fail(400, { error: 'Collez la liste de la médiathèque.' });
		return { comparison: compareWithList(db, deposit.id, text) };
	},
	remove: async (event) => {
		const deposit = loadDeposit(event.params.id);
		try {
			deleteDeposit(db, deposit.id);
		} catch (err) {
			if (err instanceof DepositError) return fail(409, { error: err.message });
			throw err;
		}
		redirect(303, '/deposits');
	}
};
