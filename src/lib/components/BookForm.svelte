<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import type { z } from 'zod';
	import type { bookSchema } from '$lib/schemas';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { parseIsbn } from '$lib/isbn';
	import { BOOK_STATUS } from '$lib/labels';
	import type { BookMetadata } from '$lib/server/metadata';
	import { localModel } from '$lib/embed/local-model.svelte';
	import { confidenceLabel, proposeShelfLocally } from '$lib/embed/classify';

	type Data = z.infer<typeof bookSchema>;
	let {
		sf,
		action,
		submitLabel = 'Enregistrer',
		showLookup = true,
		scanFirst = false,
		shelves = []
	}: {
		sf: SuperForm<Data>;
		action?: string;
		submitLabel?: string;
		showLookup?: boolean;
		/** New-book mode: a big, focused ISBN field so the scanner can go straight in. */
		scanFirst?: boolean;
		shelves?: { id: number; name: string }[];
	} = $props();

	let shelfNote = $state('');

	// svelte-ignore state_referenced_locally
	const { form, errors, message, enhance, submitting } = sf;

	let looking = $state(false);
	let lookupNote = $state('');

	/** Ask the server to find metadata for the ISBN in the form and fill the empty fields. */
	async function lookup() {
		const isbn = parseIsbn($form.isbn ?? '');
		if (!isbn) {
			lookupNote = "Saisissez d'abord un ISBN valide.";
			return;
		}
		looking = true;
		lookupNote = '';
		try {
			const res = await fetch(`/api/isbn/${isbn}`);
			if (res.status === 404) {
				lookupNote = 'Aucune notice trouvée. Remplissez les champs à la main.';
				return;
			}
			if (!res.ok) throw new Error(await res.text());
			const m = (await res.json()) as BookMetadata & {
				suggestedShelf: { id: number; name: string; reason: string } | null;
			};
			$form.isbn = m.isbn13;
			$form.title ||= m.title;
			$form.authors ||= m.authors.join('; ');
			$form.publisher ||= m.publisher ?? '';
			$form.publishedYear ||= m.publishedYear ?? null;
			$form.language ||= m.language ?? '';
			$form.pageCount ||= m.pageCount ?? null;
			$form.description ||= m.description ?? '';
			$form.coverUrl ||= m.coverUrl ?? '';
			if (m.suggestedShelf && !$form.shelfId) {
				$form.shelfId = m.suggestedShelf.id;
				shelfNote = `Rayon proposé : ${m.suggestedShelf.name} (${m.suggestedShelf.reason})`;
			} else if (!m.suggestedShelf && !$form.shelfId) {
				shelfNote = localModel.enabled
					? 'Aucune règle ne correspond ; le modèle local cherche…'
					: 'Aucun rayon ne correspond aux règles ; choisissez-le à la main.';
				if (localModel.enabled) void proposeLocally(m);
			}
			const cover = m.coverUrl ? `, couverture ${m.coverSource}` : ', pas de couverture trouvée';
			lookupNote = m.sources.length
				? `Notice : ${m.sources.join(' + ')}${cover}.`
				: `Pas de notice${cover}.`;
		} catch (e) {
			lookupNote = `Recherche impossible : ${(e as Error).message}`;
		} finally {
			looking = false;
		}
	}

	/** Second opinion from the in-browser model, only when the rules found nothing. */
	async function proposeLocally(m: BookMetadata) {
		try {
			const p = await proposeShelfLocally({
				title: m.title,
				authors: m.authors,
				publisher: m.publisher,
				description: m.description,
				subjects: m.subjects
			});
			if (!p) {
				shelfNote = 'Aucun rayon ne correspond ; choisissez-le à la main.';
				return;
			}
			if (!$form.shelfId && p.confidence !== 'unsure') $form.shelfId = p.shelfId;
			const alt = p.runnerUpName ? `, sinon ${p.runnerUpName}` : '';
			shelfNote = `Modèle local : ${p.shelfName} (${confidenceLabel[p.confidence]}${alt})${p.confidence === 'unsure' ? ' — à choisir à la main' : ''}`;
		} catch {
			shelfNote = 'Modèle local indisponible ; choisissez le rayon à la main.';
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
		<div class="flex flex-wrap gap-2">
			<Input
				id="isbn"
				name="isbn"
				bind:value={$form.isbn}
				placeholder={scanFirst
					? "Scannez le code-barres du livre, ou tapez l'ISBN"
					: "Scannez ou tapez l'ISBN"}
				onkeydown={onIsbnKeydown}
				autofocus={scanFirst}
				class={scanFirst ? 'desk-scan min-w-0 flex-1 font-mono' : 'max-w-xs font-mono'}
			/>
			{#if showLookup}
				<Button
					type="button"
					variant={scanFirst ? 'default' : 'secondary'}
					size={scanFirst ? 'lg' : 'default'}
					class={scanFirst ? 'h-14 px-6' : ''}
					onclick={lookup}
					disabled={looking}
				>
					{looking ? 'Recherche…' : 'Chercher la notice'}
				</Button>
			{/if}
		</div>
		{#if $errors.isbn}<p class="text-sm text-destructive">{$errors.isbn}</p>{/if}
		{#if lookupNote}<p class="text-sm text-muted-foreground">{lookupNote}</p>{/if}
	</div>

	<div class="space-y-1 md:col-span-2">
		<Label for="title">Titre</Label>
		<Input id="title" name="title" bind:value={$form.title} />
		{#if $errors.title}<p class="text-sm text-destructive">{$errors.title}</p>{/if}
	</div>

	<div class="space-y-1">
		<Label for="authors">Auteurs</Label>
		<Input id="authors" name="authors" bind:value={$form.authors} placeholder="Séparés par ;" />
	</div>
	<div class="space-y-1">
		<Label for="publisher">Éditeur</Label>
		<Input id="publisher" name="publisher" bind:value={$form.publisher} />
	</div>
	<div class="space-y-1">
		<Label for="publishedYear">Année</Label>
		<Input id="publishedYear" name="publishedYear" type="number" bind:value={$form.publishedYear} />
	</div>
	<div class="space-y-1">
		<Label for="language">Langue</Label>
		<Input id="language" name="language" bind:value={$form.language} placeholder="fr" />
	</div>
	<div class="space-y-1">
		<Label for="pageCount">Pages</Label>
		<Input id="pageCount" name="pageCount" type="number" bind:value={$form.pageCount} />
	</div>
	<div class="space-y-1">
		<Label for="shelfId">Rayon</Label>
		<select
			id="shelfId"
			name="shelfId"
			bind:value={$form.shelfId}
			class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
		>
			<option value={null}>—</option>
			{#each shelves as s (s.id)}
				<option value={s.id}>{s.name}</option>
			{/each}
		</select>
		{#if shelfNote}<p class="text-sm text-muted-foreground">{shelfNote}</p>{/if}
	</div>
	<div class="flex items-center gap-2 pt-6">
		<input
			id="featured"
			name="featured"
			type="checkbox"
			bind:checked={$form.featured}
			class="size-4"
		/>
		<Label for="featured">Coup de cœur (mis en avant sur le site public)</Label>
	</div>
	<div class="space-y-1">
		<Label for="rfidUid">Identifiant de la puce RFID</Label>
		<Input
			id="rfidUid"
			name="rfidUid"
			bind:value={$form.rfidUid}
			class="font-mono"
			placeholder="Scannez la puce"
		/>
		{#if $errors.rfidUid}<p class="text-sm text-destructive">{$errors.rfidUid}</p>{/if}
	</div>
	<div class="space-y-1">
		<Label for="status">État</Label>
		<select
			id="status"
			name="status"
			bind:value={$form.status}
			class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
		>
			{#each Object.entries(BOOK_STATUS) as [value, label] (value)}
				<option {value}>{label}</option>
			{/each}
		</select>
	</div>
	<div class="space-y-1 md:col-span-2">
		<Label for="coverUrl">URL de la couverture</Label>
		<div class="flex items-start gap-3">
			{#if $form.coverUrl}
				<img src={$form.coverUrl} alt="" class="h-28 w-20 flex-none rounded border object-cover" />
			{/if}
			<Input id="coverUrl" name="coverUrl" bind:value={$form.coverUrl} />
		</div>
	</div>
	<div class="space-y-1 md:col-span-2">
		<Label for="description">Résumé</Label>
		<Textarea id="description" name="description" bind:value={$form.description} rows={4} />
	</div>
	<div class="space-y-1 md:col-span-2">
		<Label for="notes">Notes internes</Label>
		<Textarea id="notes" name="notes" bind:value={$form.notes} rows={2} />
	</div>

	{#if $message}<p class="text-sm text-destructive md:col-span-2">{$message}</p>{/if}
	<div class="md:col-span-2">
		<Button type="submit" disabled={$submitting}>{submitLabel}</Button>
	</div>
</form>
