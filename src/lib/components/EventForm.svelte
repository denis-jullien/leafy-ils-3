<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import type { z } from 'zod';
	import type { eventSchema } from '$lib/schemas';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';

	type Data = z.infer<typeof eventSchema>;
	let {
		sf,
		action,
		submitLabel = 'Enregistrer'
	}: { sf: SuperForm<Data>; action?: string; submitLabel?: string } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, message, enhance, submitting } = sf;

	const tagSuggestions = ['Jeunesse', 'Adultes', 'Seniors', 'Tout public', 'Familles'];
</script>

<form method="post" {action} use:enhance class="grid gap-4 md:grid-cols-2" data-no-wedge>
	<div class="space-y-1 md:col-span-2">
		<Label for="title">Titre</Label>
		<Input id="title" name="title" bind:value={$form.title} placeholder="Heure du conte" />
		{#if $errors.title}<p class="text-sm text-destructive">{$errors.title}</p>{/if}
	</div>
	<div class="space-y-1">
		<Label for="date">Date</Label>
		<Input id="date" name="date" type="date" bind:value={$form.date} />
		{#if $errors.date}<p class="text-sm text-destructive">{$errors.date}</p>{/if}
	</div>
	<div class="space-y-1">
		<Label for="time">Horaire</Label>
		<Input id="time" name="time" bind:value={$form.time} placeholder="10h30" />
	</div>
	<div class="space-y-1">
		<Label for="tag">Public</Label>
		<Input
			id="tag"
			name="tag"
			bind:value={$form.tag}
			list="tag-suggestions"
			placeholder="Jeunesse"
		/>
		<datalist id="tag-suggestions">
			{#each tagSuggestions as t (t)}<option value={t}></option>{/each}
		</datalist>
	</div>
	<div class="flex items-center gap-2 pt-6">
		<input id="free" name="free" type="checkbox" bind:checked={$form.free} class="size-4" />
		<Label for="free">Gratuit</Label>
	</div>
	<div class="space-y-1 md:col-span-2">
		<Label for="description">Description</Label>
		<Textarea
			id="description"
			name="description"
			bind:value={$form.description}
			rows={3}
			placeholder="Histoires et comptines pour les 3–6 ans, suivies d'un goûter."
		/>
	</div>
	{#if $message}<p class="text-sm md:col-span-2">{$message}</p>{/if}
	<div class="md:col-span-2">
		<Button type="submit" disabled={$submitting}>{submitLabel}</Button>
	</div>
</form>
