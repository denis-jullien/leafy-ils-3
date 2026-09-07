<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from '$lib/toast';
	import BookForm from '$lib/components/BookForm.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { fmtDate } from '$lib/format';
	import { DEPOSIT_LENDER } from '$lib/config';

	let { data } = $props();
	/** Bumped after each book added: remounts the form, blank and focused on the first scan field. */
	let added = $state(0);
	// svelte-ignore state_referenced_locally
	const blank = { isbn: '', status: 'active' as const, depositId: data.deposit?.id ?? null };
	/** Next book: same deposit, everything else blank. */
	async function next() {
		sf.reset({ data: blank, newState: blank });
		added++;
		if (data.deposit) await invalidateAll();
	}
	// svelte-ignore state_referenced_locally
	const sf = superForm(data.form, {
		resetForm: false,
		onUpdated({ form }) {
			const m = form.message as { text: string; bookId: number } | string | undefined;
			if (!form.valid) {
				toast.error(
					typeof m === 'string'
						? m
						: (form.errors.barcode?.[0] ?? form.errors.isbn?.[0] ?? 'Vérifiez le formulaire.')
				);
				return;
			}
			if (typeof m !== 'object' || !m) return;
			toast.success(m.text, {
				duration: 8000,
				action: { label: 'Voir la fiche', onClick: () => goto(`/books/${m.bookId}`) }
			});
			void next();
		},
		onError() {
			toast.error('Erreur inattendue.');
		}
	});
</script>

<div class="space-y-4">
	{#if data.deposit}
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h1 class="text-2xl font-semibold">Réception du dépôt</h1>
			<a class="text-sm underline" href="/deposits/{data.deposit.id}">← {data.deposit.label}</a>
		</div>
		<p class="text-sm text-muted-foreground">
			<Badge variant="secondary">{data.deposit.label}</Badge>
			{data.deposit.active} livre{data.deposit.active > 1 ? 's' : ''} reçu{data.deposit.active > 1
				? 's'
				: ''} · retour le {fmtDate(data.deposit.returnOn)}. Scannez l'étiquette de la {DEPOSIT_LENDER},
			puis l'ISBN au dos du livre ; un livre déjà passé par ici est reconnu à son étiquette et n'a
			rien à ressaisir.
		</p>
	{:else}
		<h1 class="text-2xl font-semibold">Ajouter un livre</h1>
		<p class="text-sm text-muted-foreground">
			Scannez le code-barres ISBN au dos du livre. Les informations se remplissent depuis les
			catalogues en ligne ; corrigez ce qui manque et enregistrez.
		</p>
	{/if}
	{#key added}
		<BookForm
			{sf}
			shelves={data.shelves}
			deposits={data.deposits}
			submitLabel={data.deposit ? 'Ajouter au dépôt' : 'Ajouter au catalogue'}
			scanFirst
			onReceived={() => void next()}
		/>
	{/key}
</div>
