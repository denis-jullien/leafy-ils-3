<script lang="ts">
	import { enhance } from '$app/forms';
	import { superForm } from 'sveltekit-superforms';
	import BookForm from '$lib/components/BookForm.svelte';
	import Barcode from '$lib/components/Barcode.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { fmtDate } from '$lib/format';
	import { BOOK_STATUS } from '$lib/labels';

	let { data, form: actionData } = $props();
	// svelte-ignore state_referenced_locally
	const sf = superForm(data.form);
	const { message } = sf;
	const open = $derived(data.history.find((h) => !h.loan.returnedAt));
</script>

<div class="grid gap-6 lg:grid-cols-[1fr_320px]">
	<div class="space-y-4">
		<div class="flex flex-wrap items-center gap-2">
			<h1 class="text-2xl font-semibold">{data.book.title}</h1>
			{#if open}
				<Badge variant="secondary"
					>en prêt à {open.family.name}, retour le {fmtDate(open.loan.dueAt)}</Badge
				>
			{:else if data.book.status === 'active'}
				<Badge>disponible</Badge>
			{:else}
				<Badge variant="outline">{BOOK_STATUS[data.book.status]}</Badge>
			{/if}
			<Button href="/livre/{data.book.id}" variant="ghost" size="sm" target="_blank"
				>Voir sur le site</Button
			>
		</div>
		{#if $message === 'Enregistré'}<p class="text-sm text-green-700">Enregistré.</p>{/if}
		<BookForm {sf} shelves={data.shelves} action="?/save" />
	</div>

	<div class="space-y-4">
		<Card.Root>
			<Card.Header><Card.Title>Étiquette</Card.Title></Card.Header>
			<Card.Content class="space-y-2">
				{#if data.book.coverUrl}
					<img src={data.book.coverUrl} alt="" class="mb-2 h-40 rounded border object-cover" />
				{/if}
				{#if data.book.barcode}
					<Barcode value={data.book.barcode} />
				{/if}
				<p class="text-xs text-muted-foreground">
					{data.book.isbn13
						? "Scannez le code-barres de l'éditeur."
						: "Pas d'ISBN : imprimez cette étiquette et collez-la sur le livre."}
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header><Card.Title>Historique des prêts</Card.Title></Card.Header>
			<Card.Content>
				{#if data.history.length === 0}
					<p class="text-sm text-muted-foreground">Jamais emprunté.</p>
				{:else}
					<ul class="space-y-1 text-sm">
						{#each data.history as h (h.loan.id)}
							<li>
								<a class="underline" href="/families/{h.family.id}">{h.family.name}</a>
								· {fmtDate(h.loan.checkedOutAt)}
								{#if h.loan.returnedAt}→ {fmtDate(h.loan.returnedAt)}{:else}<span
										class="text-muted-foreground">(en cours)</span
									>{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</Card.Content>
		</Card.Root>

		<form
			method="post"
			action="?/delete"
			use:enhance
			onsubmit={(e) => {
				if (!confirm('Supprimer ce livre ?')) e.preventDefault();
			}}
		>
			<Button type="submit" variant="destructive" size="sm">Supprimer</Button>
			{#if actionData?.error}<p class="mt-1 text-sm text-destructive">{actionData.error}</p>{/if}
		</form>
	</div>
</div>
