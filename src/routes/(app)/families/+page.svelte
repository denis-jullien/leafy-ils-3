<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import { FAMILY_STATUS } from '$lib/labels';

	let { data } = $props();
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">Familles</h1>
		<Button href="/families/new">Nouvelle famille</Button>
	</div>

	<form method="get" class="flex gap-2" data-no-wedge>
		<Input name="q" value={data.q} placeholder="Nom ou email…" class="max-w-md" />
		<Button type="submit" variant="secondary">Rechercher</Button>
		{#if data.q}<Button href="/families" variant="ghost">Effacer</Button>{/if}
	</form>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Famille</Table.Head>
				<Table.Head>Contact</Table.Head>
				<Table.Head>Livres en prêt</Table.Head>
				<Table.Head>Abonnement</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.rows as { family, open } (family.id)}
				<Table.Row>
					<Table.Cell
						><a class="font-medium underline" href="/families/{family.id}">{family.name}</a
						></Table.Cell
					>
					<Table.Cell class="text-sm">{family.phone ?? family.email ?? ''}</Table.Cell>
					<Table.Cell>{open}</Table.Cell>
					<Table.Cell>
						{#if family.status === 'active'}<Badge>{FAMILY_STATUS.active}</Badge>{:else}<Badge
								variant="outline">{FAMILY_STATUS.inactive}</Badge
							>{/if}
					</Table.Cell>
				</Table.Row>
			{:else}
				<Table.Row
					><Table.Cell colspan={4} class="text-muted-foreground"
						>Aucune famille pour l'instant.</Table.Cell
					></Table.Row
				>
			{/each}
		</Table.Body>
	</Table.Root>
</div>
