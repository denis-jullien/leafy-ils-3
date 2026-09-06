<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import BookForm from '$lib/components/BookForm.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const sf = superForm(data.form);
</script>

<div class="space-y-4">
	<h1 class="text-2xl font-semibold">Ajouter un livre</h1>
	<p class="text-sm text-muted-foreground">
		Scannez le code-barres ISBN au dos du livre. Les informations se remplissent depuis les
		catalogues en ligne ; corrigez ce qui manque et enregistrez.
	</p>
	<BookForm {sf} shelves={data.shelves} submitLabel="Ajouter au catalogue" scanFirst />
</div>
