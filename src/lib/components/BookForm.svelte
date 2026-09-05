<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import type { z } from 'zod';
	import type { bookSchema } from '$lib/schemas';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { parseIsbn } from '$lib/isbn';
	import { CATEGORIES } from '$lib/config';
	import type { BookMetadata } from '$lib/server/metadata';

	type Data = z.infer<typeof bookSchema>;
	let {
		sf,
		action,
		submitLabel = 'Save',
		showLookup = true
	}: {
		sf: SuperForm<Data>;
		action?: string;
		submitLabel?: string;
		showLookup?: boolean;
	} = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, message, enhance, submitting } = sf;

	let looking = $state(false);
	let lookupNote = $state('');

	/** Ask the server to find metadata for the ISBN in the form and fill the empty fields. */
	async function lookup() {
		const isbn = parseIsbn($form.isbn ?? '');
		if (!isbn) {
			lookupNote = 'Enter a valid ISBN first.';
			return;
		}
		looking = true;
		lookupNote = '';
		try {
			const res = await fetch(`/api/isbn/${isbn}`);
			if (res.status === 404) {
				lookupNote = 'No record found. Fill the details by hand.';
				return;
			}
			if (!res.ok) throw new Error(await res.text());
			const m = (await res.json()) as BookMetadata;
			$form.isbn = m.isbn13;
			$form.title ||= m.title;
			$form.authors ||= m.authors.join('; ');
			$form.publisher ||= m.publisher ?? '';
			$form.publishedYear ||= m.publishedYear ?? null;
			$form.language ||= m.language ?? '';
			$form.pageCount ||= m.pageCount ?? null;
			$form.description ||= m.description ?? '';
			$form.coverUrl ||= m.coverUrl ?? '';
			lookupNote = `Found via ${m.source}.`;
		} catch (e) {
			lookupNote = `Lookup failed: ${(e as Error).message}`;
		} finally {
			looking = false;
		}
	}

	function onIsbnKeydown(e: KeyboardEvent) {
		// A scanner "types" the ISBN then Enter: trigger the lookup instead of submitting.
		if (e.key === 'Enter') {
			e.preventDefault();
			void lookup();
		}
	}
</script>

<form method="post" {action} use:enhance class="grid gap-4 md:grid-cols-2" data-no-wedge>
	<div class="space-y-1 md:col-span-2">
		<Label for="isbn">ISBN</Label>
		<div class="flex gap-2">
			<Input
				id="isbn"
				name="isbn"
				bind:value={$form.isbn}
				placeholder="Scan or type the ISBN"
				onkeydown={onIsbnKeydown}
				class="max-w-xs font-mono"
			/>
			{#if showLookup}
				<Button type="button" variant="secondary" onclick={lookup} disabled={looking}>
					{looking ? 'Looking up…' : 'Look up'}
				</Button>
			{/if}
		</div>
		{#if $errors.isbn}<p class="text-sm text-destructive">{$errors.isbn}</p>{/if}
		{#if lookupNote}<p class="text-sm text-muted-foreground">{lookupNote}</p>{/if}
	</div>

	<div class="space-y-1 md:col-span-2">
		<Label for="title">Title</Label>
		<Input id="title" name="title" bind:value={$form.title} />
		{#if $errors.title}<p class="text-sm text-destructive">{$errors.title}</p>{/if}
	</div>

	<div class="space-y-1">
		<Label for="authors">Authors</Label>
		<Input id="authors" name="authors" bind:value={$form.authors} placeholder="Separate with ;" />
	</div>
	<div class="space-y-1">
		<Label for="publisher">Publisher</Label>
		<Input id="publisher" name="publisher" bind:value={$form.publisher} />
	</div>
	<div class="space-y-1">
		<Label for="publishedYear">Year</Label>
		<Input id="publishedYear" name="publishedYear" type="number" bind:value={$form.publishedYear} />
	</div>
	<div class="space-y-1">
		<Label for="language">Language</Label>
		<Input id="language" name="language" bind:value={$form.language} placeholder="fr" />
	</div>
	<div class="space-y-1">
		<Label for="pageCount">Pages</Label>
		<Input id="pageCount" name="pageCount" type="number" bind:value={$form.pageCount} />
	</div>
	<div class="space-y-1">
		<Label for="shelf">Shelf</Label>
		<Input id="shelf" name="shelf" bind:value={$form.shelf} placeholder="e.g. Jeunesse A" />
	</div>
	<div class="space-y-1">
		<Label for="category">Category</Label>
		<select
			id="category"
			name="category"
			bind:value={$form.category}
			class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
		>
			<option value="">—</option>
			{#each CATEGORIES as c (c.id)}
				<option value={c.id}>{c.label}</option>
			{/each}
		</select>
	</div>
	<div class="flex items-center gap-2 pt-6">
		<input
			id="featured"
			name="featured"
			type="checkbox"
			bind:checked={$form.featured}
			class="size-4"
		/>
		<Label for="featured">Coup de cœur (shown first on the public site)</Label>
	</div>
	<div class="space-y-1">
		<Label for="rfidUid">RFID tag UID</Label>
		<Input
			id="rfidUid"
			name="rfidUid"
			bind:value={$form.rfidUid}
			class="font-mono"
			placeholder="Scan the tag"
		/>
		{#if $errors.rfidUid}<p class="text-sm text-destructive">{$errors.rfidUid}</p>{/if}
	</div>
	<div class="space-y-1">
		<Label for="status">Status</Label>
		<select
			id="status"
			name="status"
			bind:value={$form.status}
			class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
		>
			<option value="active">In collection</option>
			<option value="lost">Lost</option>
			<option value="withdrawn">Withdrawn</option>
		</select>
	</div>
	<div class="space-y-1 md:col-span-2">
		<Label for="coverUrl">Cover URL</Label>
		<Input id="coverUrl" name="coverUrl" bind:value={$form.coverUrl} />
	</div>
	<div class="space-y-1 md:col-span-2">
		<Label for="description">Description</Label>
		<Textarea id="description" name="description" bind:value={$form.description} rows={4} />
	</div>
	<div class="space-y-1 md:col-span-2">
		<Label for="notes">Internal notes</Label>
		<Textarea id="notes" name="notes" bind:value={$form.notes} rows={2} />
	</div>

	{#if $message}<p class="text-sm text-destructive md:col-span-2">{$message}</p>{/if}
	<div class="md:col-span-2">
		<Button type="submit" disabled={$submitting}>{submitLabel}</Button>
	</div>
</form>
