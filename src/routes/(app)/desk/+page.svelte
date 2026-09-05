<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import { fmtDate } from '$lib/format';

	let { data } = $props();
	const tiles = $derived([
		{ label: 'Books', n: data.stats.books, href: '/books' },
		{ label: 'Families', n: data.stats.families, href: '/families' },
		{ label: 'On loan', n: data.stats.onLoan, href: '/circulation' }
	]);
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">Dashboard</h1>
		<Button href="/circulation" size="lg">Start lending</Button>
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		{#each tiles as { label, n, href } (label)}
			<a {href}>
				<Card.Root>
					<Card.Header>
						<Card.Description>{label}</Card.Description>
						<Card.Title class="text-3xl">{n}</Card.Title>
					</Card.Header>
				</Card.Root>
			</a>
		{/each}
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Overdue ({data.overdue.length})</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if data.overdue.length === 0}
				<p class="text-sm text-muted-foreground">Nothing overdue. Nice village.</p>
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Book</Table.Head>
							<Table.Head>Family</Table.Head>
							<Table.Head>Due</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.overdue as l (l.id)}
							<Table.Row>
								<Table.Cell
									><a class="underline" href="/books/{l.book.id}">{l.book.title}</a></Table.Cell
								>
								<Table.Cell
									><a class="underline" href="/families/{l.family.id}">{l.family.name}</a
									></Table.Cell
								>
								<Table.Cell class="text-destructive">{fmtDate(l.dueAt)}</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
