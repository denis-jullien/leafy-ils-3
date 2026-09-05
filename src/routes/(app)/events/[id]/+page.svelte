<script lang="ts">
	import { enhance } from '$app/forms';
	import { superForm } from 'sveltekit-superforms';
	import EventForm from '$lib/components/EventForm.svelte';
	import { Button } from '$lib/components/ui/button';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const sf = superForm(data.form);
</script>

<div class="mx-auto max-w-2xl space-y-4">
	<div class="flex items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">{data.event.title}</h1>
		<Button href="/events" variant="ghost" size="sm">← Tous les événements</Button>
	</div>
	<EventForm {sf} action="?/save" />
	<form
		method="post"
		action="?/delete"
		use:enhance
		onsubmit={(e) => {
			if (!confirm('Supprimer cet événement ?')) e.preventDefault();
		}}
	>
		<Button type="submit" variant="destructive" size="sm">Supprimer</Button>
	</form>
</div>
