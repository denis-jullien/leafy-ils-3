<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import type { z } from 'zod';
	import type { bookSchema } from '$lib/schemas';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { parseIsbn } from '$lib/isbn';
	import { BOOK_STATUS, OWN_BOOK_STATUSES } from '$lib/labels';
	import { DEPOSIT_LENDER } from '$lib/config';
	import type { BookMetadata } from '$lib/server/metadata';
	import type { ReceiveResult } from '$lib/server/deposits';
	import { localModel } from '$lib/embed/local-model.svelte';
	import { confidenceLabel, proposeShelfLocally } from '$lib/embed/classify';
	import { toast } from '$lib/toast';
	import { downscaleImage } from '$lib/image-client';

	type Data = z.infer<typeof bookSchema>;
	let {
		sf,
		action,
		submitLabel = 'Enregistrer',
		showLookup = true,
		scanFirst = false,
		shelves = [],
		deposits = [],
		onReceived
	}: {
		sf: SuperForm<Data>;
		action?: string;
		submitLabel?: string;
		showLookup?: boolean;
		/** New-book mode: a big, focused ISBN field so the scanner can go straight in. */
		scanFirst?: boolean;
		shelves?: { id: number; name: string }[];
		/** Deposits a book may belong to: the open ones, plus the book's own when editing. */
		deposits?: { id: number; label: string; closedAt?: Date | null }[];
		/** Reception mode: a scanned sticker turned out to be a book already on record. */
		onReceived?: (result: ReceiveResult) => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, submitting } = sf;

	const inDeposit = $derived(!!$form.depositId);
	const statuses = $derived(
		inDeposit || $form.status === 'returned' ? Object.keys(BOOK_STATUS) : [...OWN_BOOK_STATUSES]
	) as (keyof typeof BOOK_STATUS)[];

	/* Reception of a deposit: the sticker is scanned first, and may be a known book. */
	let checkingSticker = $state(false);
	let stickerNote = $state('');
	let isbnInput: HTMLInputElement | null = $state(null);
	async function checkSticker() {
		const code = ($form.barcode ?? '').trim();
		if (!code || !$form.depositId) return;
		checkingSticker = true;
		stickerNote = '';
		try {
			const res = await fetch(`/api/deposits/${$form.depositId}/receive`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ barcode: code })
			});
			const r = (await res.json()) as ReceiveResult & { error?: string };
			if (!res.ok) throw new Error(r.error ?? 'Vérification impossible');
			switch (r.kind) {
				case 'unknown':
					stickerNote = 'Nouvelle étiquette : scannez maintenant l’ISBN au dos du livre.';
					isbnInput?.focus();
					return;
				case 'isbn':
					// The ISBN barcode was scanned instead of the sticker: keep it, ask for the sticker.
					$form.isbn = r.isbn;
					$form.barcode = '';
					stickerNote = `C'est l'ISBN (${r.isbn}), il est rempli : scannez l'étiquette de la ${DEPOSIT_LENDER}.`;
					void lookup();
					return;
				case 'already':
					toast.info(`Déjà reçu : « ${r.book.title} »`);
					break;
				case 'reactivated':
					toast.success(`De retour dans le dépôt : « ${r.book.title} »`, {
						description: 'Fiche retrouvée, rien à ressaisir.'
					});
					break;
				case 'transferred':
					toast.success(`Gardé : « ${r.book.title} »`, {
						description: `Passé du dépôt ${r.from.label} à celui-ci.`
					});
					break;
				case 'own':
					toast.error(`« ${r.book.title} » est un livre de la bibliothèque`, {
						description: "Il ne fait pas partie d'un dépôt."
					});
					$form.barcode = '';
					return;
			}
			onReceived?.(r);
		} catch (e) {
			stickerNote = `Vérification impossible : ${(e as Error).message}`;
			toast.error((e as Error).message);
		} finally {
			checkingSticker = false;
		}
	}
	function onStickerKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			void checkSticker();
		}
	}

	let shelfNote = $state('');

	// Cover picked on this device: previewed locally, shrunk before upload.
	let coverFile: File | null = $state(null);
	let coverPreview = $state('');
	let coverInput: HTMLInputElement | undefined = $state();
	async function onCoverPicked(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const original = input.files?.[0] ?? null;
		if (!original) return clearPicked();
		const small = await downscaleImage(original);
		if (small !== original) {
			// Put the shrunk file back into the input so the form posts that one.
			const dt = new DataTransfer();
			dt.items.add(small);
			input.files = dt.files;
		}
		coverFile = small;
		if (coverPreview) URL.revokeObjectURL(coverPreview);
		coverPreview = URL.createObjectURL(small);
	}
	function clearPicked() {
		coverFile = null;
		if (coverPreview) URL.revokeObjectURL(coverPreview);
		coverPreview = '';
		if (coverInput) coverInput.value = '';
	}
	const isExternal = $derived(/^https?:\/\//i.test($form.coverUrl ?? ''));

	let looking = $state(false);
	let lookupNote = $state('');
	/** Set when the lookup found a record but no cover: offers a manual search. */
	let noCoverIsbn = $state('');

	/** ISBN whose record last filled this form. Searching another one starts afresh. */
	let filledIsbn = $state('');

	/**
	 * Forget the previous record: everything a lookup can write, the shelf it
	 * proposed and a cover picked for it. Barcode, notes and status are the
	 * volunteer's own and stay.
	 */
	function clearRecord() {
		$form.title = '';
		$form.authors = '';
		$form.publisher = '';
		$form.publishedYear = null;
		$form.language = '';
		$form.pageCount = null;
		$form.description = '';
		$form.coverUrl = '';
		$form.shelfId = null;
		shelfNote = '';
		noCoverIsbn = '';
		clearPicked();
	}

	/**
	 * Ask the server to find metadata for the ISBN in the form and fill the empty
	 * fields. Values typed by hand are kept, but a record fetched for another ISBN
	 * is dropped first: scanning a second book must not mix the two.
	 */
	async function lookup() {
		const isbn = parseIsbn($form.isbn ?? '');
		if (!isbn) {
			lookupNote = "Saisissez d'abord un ISBN valide.";
			return;
		}
		if (filledIsbn && filledIsbn !== isbn) clearRecord();
		filledIsbn = isbn;
		looking = true;
		lookupNote = '';
		try {
			const res = await fetch(`/api/isbn/${isbn}`);
			if (res.status === 404) {
				lookupNote = 'Aucune notice trouvée. Remplissez les champs à la main.';
				toast.warning('Aucune notice trouvée pour cet ISBN.');
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
				toast.info(`Rayon proposé : ${m.suggestedShelf.name}`, {
					description: m.suggestedShelf.reason
				});
			} else if (!m.suggestedShelf && !$form.shelfId) {
				shelfNote = localModel.enabled
					? 'Aucune règle ne correspond ; le modèle local cherche…'
					: 'Aucun rayon ne correspond aux règles ; choisissez-le à la main.';
				if (localModel.enabled) void proposeLocally(m);
			}
			const cover = m.coverUrl
				? `, couverture ${m.coverSource}`
				: ', pas de couverture dans les catalogues';
			noCoverIsbn = m.coverUrl ? '' : m.isbn13;
			lookupNote = m.sources.length
				? `Notice : ${m.sources.join(' + ')}${cover}.`
				: `Pas de notice${cover}.`;
			const shortTitle = m.title.length > 60 ? `${m.title.slice(0, 57)}…` : m.title;
			toast.success(`Notice trouvée : ${shortTitle}`, {
				description: `${m.sources.join(' + ') || 'sans notice'}${m.coverUrl ? ', avec couverture' : ', sans couverture'}`
			});
		} catch (e) {
			lookupNote = `Recherche impossible : ${(e as Error).message}`;
			toast.error('Recherche impossible', { description: (e as Error).message });
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
			if (p.confidence === 'unsure')
				toast.warning('Rayon incertain', {
					description: `Le modèle hésite entre ${p.shelfName} et ${p.runnerUpName ?? '?'}.`
				});
			else
				toast.info(`Rayon proposé : ${p.shelfName}`, {
					description: `modèle local, ${confidenceLabel[p.confidence]}${alt}`
				});
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

<form
	method="post"
	{action}
	enctype="multipart/form-data"
	use:enhance
	class="grid grid-cols-6 gap-x-3 gap-y-4 md:grid-cols-12"
	data-no-wedge
>
	{#if deposits.length}
		<div class="col-span-6 space-y-1 md:col-span-4">
			<Label for="depositId">Origine</Label>
			<select
				id="depositId"
				name="depositId"
				bind:value={$form.depositId}
				class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
			>
				<option value={null}>Nos livres</option>
				{#each deposits as d (d.id)}
					<option value={d.id}>Dépôt · {d.label}{d.closedAt ? ' (clôturé)' : ''}</option>
				{/each}
			</select>
		</div>
		{#if inDeposit}
			<div class="col-span-6 space-y-1 md:col-span-8">
				<Label for="barcode">Étiquette de la {DEPOSIT_LENDER}</Label>
				<div class="flex flex-wrap gap-2">
					<Input
						id="barcode"
						name="barcode"
						bind:value={$form.barcode}
						placeholder="Scannez l'étiquette collée par la médiathèque"
						onkeydown={onStickerKeydown}
						onblur={() => scanFirst && void checkSticker()}
						autofocus={scanFirst}
						class={scanFirst ? 'desk-scan min-w-0 flex-1 font-mono' : 'max-w-xs font-mono'}
					/>
					{#if checkingSticker}<span class="self-center text-sm text-muted-foreground"
							>Vérification…</span
						>{/if}
				</div>
				{#if $errors.barcode}<p class="text-sm text-destructive">{$errors.barcode}</p>{/if}
				{#if stickerNote}<p class="text-sm text-muted-foreground">{stickerNote}</p>{/if}
			</div>
		{/if}
	{:else if $form.depositId}
		<input type="hidden" name="depositId" value={$form.depositId} />
		<input type="hidden" name="barcode" value={$form.barcode ?? ''} />
	{/if}

	<div class="col-span-6 space-y-1 md:col-span-12">
		<Label for="isbn">ISBN</Label>
		<div class="flex flex-wrap gap-2">
			<Input
				id="isbn"
				name="isbn"
				bind:value={$form.isbn}
				bind:ref={isbnInput}
				placeholder={scanFirst
					? "Scannez le code-barres du livre, ou tapez l'ISBN"
					: "Scannez ou tapez l'ISBN"}
				onkeydown={onIsbnKeydown}
				autofocus={scanFirst && !inDeposit}
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

	<div class="col-span-6 space-y-1 md:col-span-12">
		<Label for="title">Titre</Label>
		<Input id="title" name="title" bind:value={$form.title} />
		{#if $errors.title}<p class="text-sm text-destructive">{$errors.title}</p>{/if}
	</div>

	<div class="col-span-6 space-y-1">
		<Label for="authors">Auteurs</Label>
		<Input id="authors" name="authors" bind:value={$form.authors} placeholder="Séparés par ;" />
	</div>
	<div class="col-span-6 space-y-1">
		<Label for="publisher">Éditeur</Label>
		<Input id="publisher" name="publisher" bind:value={$form.publisher} />
	</div>

	<div class="col-span-2 space-y-1">
		<Label for="publishedYear">Année</Label>
		<Input
			id="publishedYear"
			name="publishedYear"
			type="number"
			inputmode="numeric"
			bind:value={$form.publishedYear}
		/>
	</div>
	<div class="col-span-2 space-y-1">
		<Label for="language">Langue</Label>
		<Input
			id="language"
			name="language"
			bind:value={$form.language}
			placeholder="fr"
			maxlength={3}
		/>
	</div>
	<div class="col-span-2 space-y-1">
		<Label for="pageCount">Pages</Label>
		<Input
			id="pageCount"
			name="pageCount"
			type="number"
			inputmode="numeric"
			bind:value={$form.pageCount}
		/>
	</div>
	<div class="col-span-4 space-y-1">
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
	</div>
	<div class="col-span-2 flex items-center gap-2 self-end pb-2">
		<input
			id="featured"
			name="featured"
			type="checkbox"
			bind:checked={$form.featured}
			class="size-4"
		/>
		<Label for="featured" title="Mis en avant sur le site public">Coup de cœur</Label>
	</div>
	{#if shelfNote}<p class="col-span-6 -mt-3 text-sm text-muted-foreground md:col-span-12">
			{shelfNote}
		</p>{/if}

	<div class="col-span-6 space-y-1 md:col-span-3">
		<Label for="status">État</Label>
		<select
			id="status"
			name="status"
			bind:value={$form.status}
			class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
		>
			{#each statuses as value (value)}
				<option {value}>{BOOK_STATUS[value]}</option>
			{/each}
		</select>
	</div>
	<div class="col-span-6 space-y-1 md:col-span-9">
		<Label for="coverFile">Couverture</Label>
		<div class="flex items-start gap-3">
			{#if coverPreview}
				<img src={coverPreview} alt="" class="h-20 w-14 flex-none rounded border object-cover" />
			{:else if $form.coverUrl}
				<img src={$form.coverUrl} alt="" class="h-20 w-14 flex-none rounded border object-cover" />
			{/if}
			<div class="min-w-0 flex-1 space-y-1">
				<input
					id="coverFile"
					name="coverFile"
					type="file"
					accept="image/*"
					bind:this={coverInput}
					onchange={onCoverPicked}
					class="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-semibold"
				/>
				<p class="text-xs text-muted-foreground">
					{#if coverFile}
						{coverFile.name} · {Math.round(coverFile.size / 1024)} Ko, remplacera la couverture.
						<button type="button" class="underline" onclick={clearPicked}>Annuler</button>
					{:else if isExternal}
						Image trouvée en ligne : elle sera rapatriée et stockée à l'enregistrement.
					{:else if $form.coverUrl}
						Stockée ici, en WebP.
						<label class="ml-2 inline-flex items-center gap-1"
							><input type="checkbox" name="removeCover" class="size-3.5" /> retirer</label
						>
					{:else if noCoverIsbn}
						Aucune couverture chez BnF, Open Library ni Google Books.
						<a
							class="underline"
							href="https://www.google.com/search?tbm=isch&q={noCoverIsbn}"
							target="_blank"
							rel="noopener">Chercher sur Google Images</a
						>, puis collez l'adresse de l'image ci-dessous, ou prenez une photo.
					{:else}
						Photo ou fichier ; l'image est réduite et convertie automatiquement.
					{/if}
				</p>
				<details class="text-xs text-muted-foreground">
					<summary class="cursor-pointer">Adresse d'une image en ligne</summary>
					<Input
						name="coverUrl"
						bind:value={$form.coverUrl}
						class="mt-1 h-8 text-xs"
						placeholder="https://…"
					/>
				</details>
			</div>
		</div>
	</div>

	<div class="col-span-6 space-y-1 md:col-span-12">
		<Label for="description">Résumé</Label>
		<Textarea id="description" name="description" bind:value={$form.description} rows={3} />
	</div>
	<div class="col-span-6 space-y-1 md:col-span-12">
		<Label for="notes">Notes internes</Label>
		<Textarea id="notes" name="notes" bind:value={$form.notes} rows={2} />
	</div>
	<div class="col-span-6 md:col-span-12">
		<Button type="submit" disabled={$submitting}>{submitLabel}</Button>
	</div>
</form>
