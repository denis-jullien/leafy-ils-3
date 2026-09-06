<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Table from '$lib/components/ui/table';
	import SortHead from '$lib/components/SortHead.svelte';
	import HeadFilter from '$lib/components/HeadFilter.svelte';
	import Pager from '$lib/components/Pager.svelte';
	import QuickField from '$lib/components/QuickField.svelte';
	import { FAMILY_STATUS } from '$lib/labels';

	let { data } = $props();
	const statusOptions = Object.entries(FAMILY_STATUS).map(([value, label]) => ({ value, label }));
	const statusFilter = [{ value: '', label: 'Tous' }, ...statusOptions];
	const pretFilter = [
		{ value: '', label: 'Tous' },
		{ value: 'oui', label: 'Avec des prêts' }
	];
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">Familles</h1>
		<Button href="/families/new">Nouvelle famille</Button>
	</div>

	<form method="get" data-no-wedge data-sveltekit-noscroll data-sveltekit-keepfocus>
		{#if data.sort !== 'name'}<input type="hidden" name="sort" value={data.sort} /><input
				type="hidden"
				name="dir"
				value={data.dir}
			/>{/if}
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<SortHead key="name" label="Famille" sort={data.sort} dir={data.dir} />
					<SortHead key="contact" label="Téléphone" sort={data.sort} dir={data.dir} />
					<Table.Head>Email</Table.Head>
					<SortHead key="open" label="Livres en prêt" sort={data.sort} dir={data.dir} />
					<SortHead key="status" label="Abonnement" sort={data.sort} dir={data.dir} />
				</Table.Row>
				<Table.Row class="filter-row">
					<Table.Head
						><HeadFilter
							name="n"
							value={data.filters.name}
							placeholder="Nom"
							label="Filtrer par nom"
						/></Table.Head
					>
					<Table.Head
						><HeadFilter
							name="tel"
							value={data.filters.phone}
							placeholder="Téléphone"
							label="Filtrer par téléphone"
						/></Table.Head
					>
					<Table.Head
						><HeadFilter
							name="e"
							value={data.filters.email}
							placeholder="Email"
							label="Filtrer par email"
						/></Table.Head
					>
					<Table.Head
						><HeadFilter
							name="pret"
							kind="select"
							value={data.filters.pret}
							options={pretFilter}
							label="Prêts en cours"
						/></Table.Head
					>
					<Table.Head>
						<HeadFilter
							name="statut"
							kind="select"
							value={data.filters.statut}
							options={statusFilter}
							label="Filtrer par abonnement"
						/>
						{#if data.hasFilters}<a class="head-check" href="/families">✕ effacer les filtres</a
							>{/if}
					</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.rows as { family, open } (family.id)}
					<Table.Row>
						<Table.Cell
							><a class="font-medium underline" href="/families/{family.id}">{family.name}</a
							></Table.Cell
						>
						<Table.Cell>
							<QuickField
								endpoint="/api/families/{family.id}"
								field="phone"
								value={family.phone}
								placeholder="—"
								label="Téléphone"
							/>
						</Table.Cell>
						<Table.Cell class="text-sm">{family.email ?? ''}</Table.Cell>
						<Table.Cell>{open}</Table.Cell>
						<Table.Cell>
							<QuickField
								endpoint="/api/families/{family.id}"
								field="status"
								kind="select"
								value={family.status}
								options={statusOptions}
								label="Abonnement"
							/>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row
						><Table.Cell colspan={5} class="text-muted-foreground"
							>Aucune famille ne correspond.</Table.Cell
						></Table.Row
					>
				{/each}
			</Table.Body>
		</Table.Root>
	</form>

	<Pager current={data.page} total={data.total} />
</div>
