<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table';
	import SortHead from '$lib/components/SortHead.svelte';
	import Pager from '$lib/components/Pager.svelte';
	import QuickField from '$lib/components/QuickField.svelte';
	import { FAMILY_STATUS } from '$lib/labels';

	let { data } = $props();
	let filterForm: HTMLFormElement | undefined = $state();
	const hasFilters = $derived(!!(data.q || data.filters.statut || data.filters.pret));
	const statusOptions = Object.entries(FAMILY_STATUS).map(([value, label]) => ({ value, label }));
	const submit = () => filterForm?.requestSubmit();
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">Familles</h1>
		<Button href="/families/new">Nouvelle famille</Button>
	</div>

	<form
		method="get"
		class="filters-bar"
		bind:this={filterForm}
		data-no-wedge
		data-sveltekit-noscroll
	>
		{#if data.sort !== 'name'}<input type="hidden" name="sort" value={data.sort} /><input
				type="hidden"
				name="dir"
				value={data.dir}
			/>{/if}
		<Input name="q" value={data.q} placeholder="Nom, email ou téléphone…" class="w-64" />
		<select name="statut" value={data.filters.statut} onchange={submit} aria-label="Abonnement">
			<option value="">Tous abonnements</option>
			{#each statusOptions as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
		</select>
		<select name="pret" value={data.filters.pret} onchange={submit} aria-label="Prêts en cours">
			<option value="">Avec ou sans prêt</option>
			<option value="oui">Avec des livres en prêt</option>
		</select>
		<Button type="submit" variant="secondary">Rechercher</Button>
		{#if hasFilters}<Button href="/families" variant="ghost">Effacer</Button>{/if}
	</form>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<SortHead key="name" label="Famille" sort={data.sort} dir={data.dir} />
				<SortHead key="contact" label="Téléphone" sort={data.sort} dir={data.dir} />
				<Table.Head>Email</Table.Head>
				<SortHead key="open" label="Livres en prêt" sort={data.sort} dir={data.dir} />
				<SortHead key="status" label="Abonnement" sort={data.sort} dir={data.dir} />
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

	<Pager current={data.page} total={data.total} />
</div>
