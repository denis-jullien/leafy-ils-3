<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { formToasts } from '$lib/toast';
	import FamilyForm from '$lib/components/FamilyForm.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const sf = superForm(data.form, formToasts({ created: 'Famille créée' }));
</script>

<div class="space-y-4">
	<h1 class="text-2xl font-semibold">Nouvelle famille</h1>
	<FamilyForm {sf} submitLabel="Créer la famille" />
</div>
