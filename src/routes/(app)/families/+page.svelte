<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';

	let { data } = $props();
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">Families</h1>
		<Button href="/families/new">New family</Button>
	</div>

	<form method="get" class="flex gap-2" data-no-wedge>
		<Input name="q" value={data.q} placeholder="Name, card number or email…" class="max-w-md" />
		<Button type="submit" variant="secondary">Search</Button>
		{#if data.q}<Button href="/families" variant="ghost">Clear</Button>{/if}
	</form>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Family</Table.Head>
				<Table.Head>Card</Table.Head>
				<Table.Head>Contact</Table.Head>
				<Table.Head>Books out</Table.Head>
				<Table.Head>Status</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.rows as { family, open } (family.id)}
				<Table.Row>
					<Table.Cell
						><a class="font-medium underline" href="/families/{family.id}">{family.name}</a
						></Table.Cell
					>
					<Table.Cell class="font-mono text-xs">{family.barcode}</Table.Cell>
					<Table.Cell class="text-sm">{family.phone ?? family.email ?? ''}</Table.Cell>
					<Table.Cell>{open}</Table.Cell>
					<Table.Cell>
						{#if family.status === 'active'}<Badge>active</Badge>{:else}<Badge variant="outline"
								>inactive</Badge
							>{/if}
					</Table.Cell>
				</Table.Row>
			{:else}
				<Table.Row
					><Table.Cell colspan={5} class="text-muted-foreground">No families yet.</Table.Cell
					></Table.Row
				>
			{/each}
		</Table.Body>
	</Table.Root>
</div>
