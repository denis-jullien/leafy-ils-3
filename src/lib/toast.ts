/**
 * Toasts for the desk. Thin wrappers over svelte-sonner so every page tells the
 * volunteer the same way that something happened: a record was found, a save
 * went through, a loan was recorded, or something failed.
 */
import { toast } from 'svelte-sonner';
import type { ActionResult } from '@sveltejs/kit';

export { toast };

type FormLike = { message?: unknown; valid?: boolean } | undefined;
type ResultData = { form?: FormLike; error?: unknown; [k: string]: unknown } | undefined;

function messageOf(result: ActionResult): string | null {
	if (result.type !== 'success' && result.type !== 'failure') return null;
	const data = result.data as ResultData;
	const m = data?.form?.message ?? data?.error;
	return typeof m === 'string' && m ? m : null;
}

/**
 * superForm options that toast the outcome of a submission. Server-side
 * messages come through as-is; a redirect (create then go to the page) uses
 * `created`; a failed validation gets a generic nudge.
 */
export function formToasts(opts: { created?: string; saved?: string; reset?: boolean } = {}) {
	return {
		// Edit forms keep what was just saved (superforms resets by default); "add" forms clear.
		resetForm: opts.reset ?? false,
		onResult: ({ result }: { result: ActionResult }) => {
			switch (result.type) {
				case 'success':
					toast.success(messageOf(result) ?? opts.saved ?? 'Enregistré');
					break;
				case 'redirect':
					if (opts.created) toast.success(opts.created);
					break;
				case 'failure':
					toast.error(messageOf(result) ?? 'Vérifiez le formulaire.');
					break;
				case 'error':
					toast.error('Erreur inattendue.');
					break;
			}
		}
	};
}

/**
 * For plain `use:enhance` forms (buttons that post an action): toast, then let
 * SvelteKit apply the result as usual.
 */
export function enhanceToasts(success: string) {
	return () =>
		async ({
			result,
			update
		}: {
			result: ActionResult;
			update: (o?: { reset?: boolean }) => Promise<void>;
		}) => {
			if (result.type === 'success' || result.type === 'redirect') toast.success(success);
			else if (result.type === 'failure') toast.error(messageOf(result) ?? 'Action impossible.');
			else if (result.type === 'error') toast.error('Erreur inattendue.');
			await update();
		};
}
