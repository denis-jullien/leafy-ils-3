<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import { fmtDate } from '$lib/format';
	import { formatIsbn13 } from '$lib/isbn';

	let { data } = $props();
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">Books</h1>
		<Button href="/books/new">Add a book</Button>
	</div>

	<form method="get" class="flex gap-2" data-no-wedge>
		<Input name="q" value={data.q} placeholder="Title, author, ISBN or label…" class="max-w-md" />
		<Button type="submit" variant="secondary">Search</Button>
		{#if data.q}<Button href="/books" variant="ghost">Clear</Button>{/if}
	</form>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Title</Table.Head>
				<Table.Head>Authors</Table.Head>
				<Table.Head>ISBN / label</Table.Head>
				<Table.Head>Shelf</Table.Head>
				<Table.Head>Status</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.rows as { book, onLoanTo, dueAt } (book.id)}
				<Table.Row>
					<Table.Cell
						><a class="font-medium underline" href="/books/{book.id}">{book.title}</a></Table.Cell
					>
					<Table.Cell>{book.authors ?? ''}</Table.Cell>
					<Table.Cell class="font-mono text-xs"
						>{book.isbn13 ? formatIsbn13(book.isbn13) : book.barcode}</Table.Cell
					>
					<Table.Cell>{book.shelf ?? ''}</Table.Cell>
					<Table.Cell>
						{#if book.status !== 'active'}
							<Badge variant="outline">{book.status}</Badge>
						{:else if onLoanTo}
							<Badge variant="secondary">on loan · due {fmtDate(dueAt)}</Badge>
						{:else}
							<Badge>available</Badge>
						{/if}
					</Table.Cell>
				</Table.Row>
			{:else}
				<Table.Row
					><Table.Cell colspan={5} class="text-muted-foreground">No books yet.</Table.Cell
					></Table.Row
				>
			{/each}
		</Table.Body>
	</Table.Root>
</div>
