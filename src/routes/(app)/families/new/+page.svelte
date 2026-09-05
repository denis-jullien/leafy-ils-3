<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import FamilyForm from '$lib/components/FamilyForm.svelte';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const sf = superForm(data.form);
</script>

<div class="space-y-4">
	<h1 class="text-2xl font-semibold">New family</h1>
	<FamilyForm {sf} submitLabel="Create family" />
</div>
