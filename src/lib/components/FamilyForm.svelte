<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import type { z } from 'zod';
	import type { familySchema } from '$lib/schemas';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';

	type Data = z.infer<typeof familySchema>;
	let {
		sf,
		action,
		submitLabel = 'Save'
	}: { sf: SuperForm<Data>; action?: string; submitLabel?: string } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, message, enhance, submitting } = sf;
</script>

<form method="post" {action} use:enhance class="grid gap-4 md:grid-cols-2" data-no-wedge>
	<div class="space-y-1 md:col-span-2">
		<Label for="name">Family name</Label>
		<Input id="name" name="name" bind:value={$form.name} placeholder="Famille Dupont" />
		{#if $errors.name}<p class="text-sm text-destructive">{$errors.name}</p>{/if}
	</div>
	<div class="space-y-1">
		<Label for="email">Email</Label>
		<Input id="email" name="email" type="email" bind:value={$form.email} />
	</div>
	<div class="space-y-1">
		<Label for="phone">Phone</Label>
		<Input id="phone" name="phone" bind:value={$form.phone} />
	</div>
	<div class="space-y-1 md:col-span-2">
		<Label for="address">Address</Label>
		<Input id="address" name="address" bind:value={$form.address} />
	</div>
	<div class="space-y-1">
		<Label for="status">Membership</Label>
		<select
			id="status"
			name="status"
			bind:value={$form.status}
			class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
		>
			<option value="active">Active</option>
			<option value="inactive">Inactive</option>
		</select>
	</div>
	<div class="space-y-1 md:col-span-2">
		<Label for="notes">Notes</Label>
		<Textarea id="notes" name="notes" bind:value={$form.notes} rows={2} />
	</div>
	{#if $message}<p class="text-sm md:col-span-2">{$message}</p>{/if}
	<div class="md:col-span-2">
		<Button type="submit" disabled={$submitting}>{submitLabel}</Button>
	</div>
</form>
