<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from '$lib/toast';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import SortHead from '$lib/components/SortHead.svelte';
	import HeadFilter from '$lib/components/HeadFilter.svelte';
	import Pager from '$lib/components/Pager.svelte';
	import QuickField from '$lib/components/QuickField.svelte';
	import { fmtDate } from '$lib/format';
	import { BOOK_STATUS, ETAT_OPTIONS, OWN_BOOK_STATUSES } from '$lib/labels';

	let { data, form } = $props();
	let filling = $state(false);

	const shelfOptions = $derived([
		{ value: '', label: '—' },
		...data.shelves.map((s) => ({ value: String(s.id), label: s.name }))
	]);
	const shelfFilter = $derived([
		{ value: '', label: 'Tous' },
		{ value: 'none', label: 'Sans rayon' },
		...data.shelves.map((s) => ({ value: String(s.id), label: s.name }))
	]);
	const statusOptions = Object.entries(BOOK_STATUS).map(([value, label]) => ({ value, label }));
	const ownStatusOptions = statusOptions.filter((o) =>
		(OWN_BOOK_STATUSES as readonly string[]).includes(o.value)
	);
	const origOptions = $derived([
		{ value: '', label: 'Toutes origines' },
		{ value: 'nous', label: 'Nos livres' },
		...(data.deposits.length ? [{ value: 'depot', label: 'Tous les dépôts' }] : []),
		...data.deposits.map((d) => ({
			value: String(d.id),
			label: `Dépôt · ${d.label}${d.closed ? ' (clôturé)' : ''}`
		}))
	]);
	const coeurOptions = [
		{ value: '', label: 'Tous' },
		{ value: 'oui', label: 'Coups de cœur' }
	];
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
						return async ({ result, update }) => {
							filling = false;
							if (result.type === 'success')
								toast.success(String((result.data as { covers?: string })?.covers ?? 'Terminé'));
							else toast.error('La recherche de couvertures a échoué.');
							await update();
						};
					}}
				>
					<Button type="submit" variant="outline" disabled={filling}>
						{filling ? 'Recherche…' : `Chercher les couvertures manquantes (${data.missingCovers})`}
					</Button>
				</form>
			{/if}
			{#if data.externalCovers > 0}
				<form
					method="post"
					action="?/importCovers"
					use:enhance={() => {
						filling = true;
						return async ({ result, update }) => {
							filling = false;
							if (result.type === 'success')
								toast.success(String((result.data as { covers?: string })?.covers ?? 'Terminé'));
							else toast.error('Le rapatriement a échoué.');
							await update();
						};
					}}
				>
					<Button type="submit" variant="outline" disabled={filling}>
						{filling
							? 'Rapatriement…'
							: `Rapatrier les couvertures externes (${data.externalCovers})`}
					</Button>
				</form>
			{/if}
			<Button href="/shelves" variant="outline">Rayons</Button>
			<Button href="/deposits" variant="outline">Dépôts</Button>
			<Button href="/books/new">Ajouter un livre</Button>
		</div>
	</div>
	{#if form?.covers}<p class="text-sm text-muted-foreground">{form.covers}</p>{/if}

	<form method="get" data-no-wedge data-sveltekit-noscroll data-sveltekit-keepfocus>
		{#if data.sort !== 'added'}<input type="hidden" name="sort" value={data.sort} /><input
				type="hidden"
				name="dir"
				value={data.dir}
			/>{/if}
		<Table.Root class="table-fixed">
			<Table.Header>
				<Table.Row>
					<SortHead key="title" label="Titre" sort={data.sort} dir={data.dir} class="w-[34%]" />
					<SortHead key="authors" label="Auteurs" sort={data.sort} dir={data.dir} class="w-[22%]" />
					<SortHead key="year" label="Année" sort={data.sort} dir={data.dir} class="w-[7%]" />
					<SortHead key="shelf" label="Rayon" sort={data.sort} dir={data.dir} class="w-[15%]" />
					<Table.Head title="Coup de cœur" class="w-[5%]">♥</Table.Head>
					<SortHead key="status" label="État" sort={data.sort} dir={data.dir} class="w-[17%]" />
				</Table.Row>
				<Table.Row class="filter-row">
					<Table.Head>
						<HeadFilter
							name="t"
							value={data.filters.title}
							placeholder="Titre ou ISBN"
							label="Filtrer par titre"
						/>
						<span class="flex flex-wrap items-center gap-x-3">
							<label class="head-check"
								><input
									type="checkbox"
									name="couv"
									value="sans"
									checked={data.filters.couv === 'sans'}
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
								/> sans couverture</label
							>
							<HeadFilter
								name="orig"
								kind="select"
								value={data.filters.orig}
								options={origOptions}
								label="Filtrer par origine"
							/>
						</span>
					</Table.Head>
					<Table.Head
						><HeadFilter
							name="a"
							value={data.filters.authors}
							placeholder="Auteur"
							label="Filtrer par auteur"
						/></Table.Head
					>
					<Table.Head
						><HeadFilter
							name="y"
							value={data.filters.year}
							placeholder="20…"
							label="Filtrer par année"
						/></Table.Head
					>
					<Table.Head
						><HeadFilter
							name="r"
							kind="select"
							value={data.filters.shelf}
							options={shelfFilter}
							label="Filtrer par rayon"
						/></Table.Head
					>
					<Table.Head
						><HeadFilter
							name="coeur"
							kind="select"
							value={data.filters.coeur}
							options={coeurOptions}
							label="Coups de cœur"
						/></Table.Head
					>
					<Table.Head>
						<HeadFilter
							name="etat"
							kind="select"
							value={data.filters.etat}
							options={[...ETAT_OPTIONS]}
							label="Filtrer par état"
						/>
						{#if data.hasFilters}<a class="head-check" href="/books">✕ effacer les filtres</a>{/if}
					</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.rows as { book, onLoanTo, dueAt, deposit } (book.id)}
					<Table.Row>
						<Table.Cell class="cell-wrap">
							<a class="font-medium underline" href="/books/{book.id}">{book.title}</a>
							{#if deposit}<Badge
									variant="outline"
									class="ml-1 align-middle"
									title="Livre de la médiathèque départementale · {deposit}">dépôt</Badge
								>{/if}
							{#if !book.coverUrl}<span
									class="ml-1 text-xs text-muted-foreground"
									title="Pas de couverture">◌</span
								>{/if}
						</Table.Cell>
						<Table.Cell class="cell-clip" title={book.authors ?? ''}
							>{book.authors ?? ''}</Table.Cell
						>
						<Table.Cell>{book.publishedYear ?? ''}</Table.Cell>
						<Table.Cell>
							<QuickField
								endpoint="/api/books/{book.id}"
								field="shelfId"
								kind="select"
								value={book.shelfId === null ? '' : String(book.shelfId)}
								options={shelfOptions}
								label="Rayon"
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
									options={book.depositId || book.status === 'returned'
										? statusOptions
										: ownStatusOptions}
									label="État"
								/>
							{/if}
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row
						><Table.Cell colspan={6} class="text-muted-foreground"
							>Aucun livre ne correspond.</Table.Cell
						></Table.Row
					>
				{/each}
			</Table.Body>
		</Table.Root>
	</form>

	<Pager current={data.page} total={data.total} />
</div>
