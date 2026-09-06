<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import SortHead from '$lib/components/SortHead.svelte';
	import Pager from '$lib/components/Pager.svelte';
	import QuickField from '$lib/components/QuickField.svelte';
	import { fmtDate } from '$lib/format';
	import { BOOK_STATUS } from '$lib/labels';
	import { CATEGORIES } from '$lib/config';

	let { data, form } = $props();
	let filling = $state(false);
	let filterForm: HTMLFormElement | undefined = $state();

	const hasFilters = $derived(
		!!(data.q || data.filters.cat || data.filters.dispo || data.filters.etat || data.filters.couv)
	);
	const categoryOptions = [
		{ value: '', label: '—' },
		...CATEGORIES.map((c) => ({ value: c.id, label: c.label }))
	];
	const statusOptions = Object.entries(BOOK_STATUS).map(([value, label]) => ({ value, label }));
	const submit = () => filterForm?.requestSubmit();
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">Livres</h1>
		<div class="flex flex-wrap items-center gap-2">
			{#if data.missingCovers > 0}
				<form
					method="post"
					action="?/fillCovers"
					use:enhance={() => {
						filling = true;
						return async ({ update }) => {
							filling = false;
							await update();
						};
					}}
				>
					<Button type="submit" variant="outline" disabled={filling}>
						{filling ? 'Recherche…' : `Chercher les couvertures manquantes (${data.missingCovers})`}
					</Button>
				</form>
			{/if}
			<Button href="/books/new">Ajouter un livre</Button>
		</div>
	</div>
	{#if form?.covers}<p class="text-sm text-muted-foreground">{form.covers}</p>{/if}

	<form
		method="get"
		class="filters-bar"
		bind:this={filterForm}
		data-no-wedge
		data-sveltekit-noscroll
	>
		{#if data.sort !== 'added'}<input type="hidden" name="sort" value={data.sort} /><input
				type="hidden"
				name="dir"
				value={data.dir}
			/>{/if}
		<Input name="q" value={data.q} placeholder="Titre, auteur, éditeur, ISBN…" class="w-64" />
		<select name="cat" value={data.filters.cat} onchange={submit} aria-label="Catégorie">
			<option value="">Toutes catégories</option>
			{#each CATEGORIES as c (c.id)}<option value={c.id}>{c.label}</option>{/each}
		</select>
		<select name="dispo" value={data.filters.dispo} onchange={submit} aria-label="Disponibilité">
			<option value="">Disponibles et en prêt</option>
			<option value="oui">Disponibles</option>
			<option value="non">En prêt</option>
		</select>
		<select name="etat" value={data.filters.etat} onchange={submit} aria-label="État">
			<option value="">Tous états</option>
			{#each statusOptions as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
		</select>
		<select name="couv" value={data.filters.couv} onchange={submit} aria-label="Couverture">
			<option value="">Avec ou sans couverture</option>
			<option value="sans">Sans couverture</option>
		</select>
		<Button type="submit" variant="secondary">Rechercher</Button>
		{#if hasFilters}<Button href="/books" variant="ghost">Effacer</Button>{/if}
	</form>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<SortHead key="title" label="Titre" sort={data.sort} dir={data.dir} />
				<SortHead key="authors" label="Auteurs" sort={data.sort} dir={data.dir} />
				<SortHead key="year" label="Année" sort={data.sort} dir={data.dir} />
				<SortHead key="shelf" label="Rayon" sort={data.sort} dir={data.dir} />
				<SortHead key="category" label="Catégorie" sort={data.sort} dir={data.dir} />
				<Table.Head title="Coup de cœur">♥</Table.Head>
				<SortHead key="status" label="État" sort={data.sort} dir={data.dir} />
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.rows as { book, onLoanTo, dueAt } (book.id)}
				<Table.Row>
					<Table.Cell>
						<a class="font-medium underline" href="/books/{book.id}">{book.title}</a>
						{#if book.coverUrl}{:else}<span
								class="ml-1 text-xs text-muted-foreground"
								title="Pas de couverture">◌</span
							>{/if}
					</Table.Cell>
					<Table.Cell>{book.authors ?? ''}</Table.Cell>
					<Table.Cell>{book.publishedYear ?? ''}</Table.Cell>
					<Table.Cell>
						<QuickField
							endpoint="/api/books/{book.id}"
							field="shelf"
							value={book.shelf}
							placeholder="—"
							label="Rayon"
						/>
					</Table.Cell>
					<Table.Cell>
						<QuickField
							endpoint="/api/books/{book.id}"
							field="category"
							kind="select"
							value={book.category}
							options={categoryOptions}
							label="Catégorie"
						/>
					</Table.Cell>
					<Table.Cell>
						<QuickField
							endpoint="/api/books/{book.id}"
							field="featured"
							kind="checkbox"
							value={book.featured}
							label="Coup de cœur"
						/>
					</Table.Cell>
					<Table.Cell>
						{#if onLoanTo}
							<Badge variant="secondary">en prêt · retour {fmtDate(dueAt)}</Badge>
						{:else}
							<QuickField
								endpoint="/api/books/{book.id}"
								field="status"
								kind="select"
								value={book.status}
								options={statusOptions}
								label="État"
							/>
						{/if}
					</Table.Cell>
				</Table.Row>
			{:else}
				<Table.Row
					><Table.Cell colspan={7} class="text-muted-foreground"
						>Aucun livre ne correspond.</Table.Cell
					></Table.Row
				>
			{/each}
		</Table.Body>
	</Table.Root>

	<Pager current={data.page} total={data.total} />
</div>
