<script lang="ts">
	import { goto } from '$app/navigation';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from '$lib/toast';
	import BookForm from '$lib/components/BookForm.svelte';

	let { data } = $props();
	/** Bumped after each book added: remounts the form, blank and focused on the ISBN. */
	let added = $state(0);
	const blank = { isbn: '', status: 'active' as const };
	// svelte-ignore state_referenced_locally
	const sf = superForm(data.form, {
		resetForm: false,
		onUpdated({ form }) {
			const m = form.message as { text: string; bookId: number } | string | undefined;
			if (!form.valid) {
				toast.error(
					typeof m === 'string' ? m : (form.errors.isbn?.[0] ?? 'Vérifiez le formulaire.')
				);
				return;
			}
			if (typeof m !== 'object' || !m) return;
			toast.success(m.text, {
				duration: 8000,
				action: { label: 'Voir la fiche', onClick: () => goto(`/books/${m.bookId}`) }
			});
			sf.reset({ data: blank, newState: blank });
			added++;
		},
		onError() {
			toast.error('Erreur inattendue.');
		}
	});
</script>

<div class="space-y-4">
	<h1 class="text-2xl font-semibold">Ajouter un livre</h1>
	<p class="text-sm text-muted-foreground">
		Scannez le code-barres ISBN au dos du livre. Les informations se remplissent depuis les
		catalogues en ligne ; corrigez ce qui manque et enregistrez.
	</p>
	{#key added}
		<BookForm {sf} shelves={data.shelves} submitLabel="Ajouter au catalogue" scanFirst />
	{/key}
</div>
