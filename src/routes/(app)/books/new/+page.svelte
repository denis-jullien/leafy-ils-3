<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import BookForm from '$lib/components/BookForm.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const sf = superForm(data.form);
</script>

<div class="space-y-4">
	<h1 class="text-2xl font-semibold">Add a book</h1>
	<p class="text-sm text-muted-foreground">
		Scan the ISBN barcode on the back cover. The details fill in from the catalogue services; fix
		whatever they got wrong and save.
	</p>
	<BookForm {sf} submitLabel="Add to catalogue" />
</div>
