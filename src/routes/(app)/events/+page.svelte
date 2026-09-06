<script lang="ts">
	import { enhance } from '$app/forms';
	import { superForm } from 'sveltekit-superforms';
	import { enhanceToasts, formToasts } from '$lib/toast';
	import EventForm from '$lib/components/EventForm.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { fmtDate } from '$lib/format';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const sf = superForm(data.form, formToasts({ reset: true }));
	const upcoming = $derived(data.events.filter((e) => e.date >= data.today).reverse());
	const past = $derived(data.events.filter((e) => e.date < data.today));
</script>

{#snippet rows(list: typeof data.events)}
	{#each list as e (e.id)}
		<Table.Row>
			<Table.Cell class="whitespace-nowrap"
				>{fmtDate(e.date)}{e.time ? ` · ${e.time}` : ''}</Table.Cell
			>
			<Table.Cell><a class="font-medium underline" href="/events/{e.id}">{e.title}</a></Table.Cell>
			<Table.Cell
				>{#if e.tag}<Badge variant="secondary">{e.tag}</Badge>{/if}</Table.Cell
			>
			<Table.Cell class="text-right">
				<form
					method="post"
					action="?/delete"
					use:enhance={enhanceToasts('Événement supprimé')}
					onsubmit={(ev) => {
						if (!confirm(`Supprimer « ${e.title} » ?`)) ev.preventDefault();
					}}
				>
					<input type="hidden" name="id" value={e.id} />
					<Button type="submit" size="sm" variant="ghost" class="text-destructive">Supprimer</Button
					>
				</form>
			</Table.Cell>
		</Table.Row>
	{/each}
{/snippet}

<div class="grid gap-6 lg:grid-cols-[1fr_400px]">
	<div class="space-y-6">
		<h1 class="text-2xl font-semibold">Événements</h1>
		<p class="text-sm text-muted-foreground">
			Les quatre prochains événements s'affichent sur le site public. Les événements passés
			disparaissent d'eux-mêmes.
		</p>

		<Card.Root>
			<Card.Header><Card.Title>À venir ({upcoming.length})</Card.Title></Card.Header>
			<Card.Content>
				{#if upcoming.length === 0}
					<p class="text-sm text-muted-foreground">
						Rien de prévu. Ajoutez un événement ci-contre.
					</p>
				{:else}
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Quand</Table.Head>
								<Table.Head>Titre</Table.Head>
								<Table.Head>Public</Table.Head>
								<Table.Head></Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>{@render rows(upcoming)}</Table.Body>
					</Table.Root>
				{/if}
			</Card.Content>
		</Card.Root>

		{#if past.length > 0}
			<details>
				<summary class="cursor-pointer text-sm text-muted-foreground"
					>Événements passés ({past.length})</summary
				>
				<Table.Root>
					<Table.Body>{@render rows(past)}</Table.Body>
				</Table.Root>
			</details>
		{/if}
	</div>

	<Card.Root class="self-start">
		<Card.Header><Card.Title>Nouvel événement</Card.Title></Card.Header>
		<Card.Content><EventForm {sf} action="?/create" submitLabel="Ajouter" /></Card.Content>
	</Card.Root>
</div>
