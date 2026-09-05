<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import { fmtDate } from '$lib/format';
	import { formatIsbn13 } from '$lib/isbn';
	import { BOOK_STATUS } from '$lib/labels';

	let { data } = $props();
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">Livres</h1>
		<Button href="/books/new">Ajouter un livre</Button>
	</div>

	<form method="get" class="flex gap-2" data-no-wedge>
		<Input
			name="q"
			value={data.q}
			placeholder="Titre, auteur, ISBN ou étiquette…"
			class="max-w-md"
		/>
		<Button type="submit" variant="secondary">Rechercher</Button>
		{#if data.q}<Button href="/books" variant="ghost">Effacer</Button>{/if}
	</form>

	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Titre</Table.Head>
				<Table.Head>Auteurs</Table.Head>
				<Table.Head>ISBN / étiquette</Table.Head>
				<Table.Head>Rayon</Table.Head>
				<Table.Head>État</Table.Head>
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
							<Badge variant="outline">{BOOK_STATUS[book.status]}</Badge>
						{:else if onLoanTo}
							<Badge variant="secondary">en prêt · retour {fmtDate(dueAt)}</Badge>
						{:else}
							<Badge>disponible</Badge>
						{/if}
					</Table.Cell>
				</Table.Row>
			{:else}
				<Table.Row
					><Table.Cell colspan={5} class="text-muted-foreground"
						>Aucun livre pour l'instant.</Table.Cell
					></Table.Row
				>
			{/each}
		</Table.Body>
	</Table.Root>
</div>
