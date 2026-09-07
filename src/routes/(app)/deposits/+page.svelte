<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { formToasts } from '$lib/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import DepositProgress from '$lib/components/DepositProgress.svelte';
	import { fmtDate } from '$lib/format';
	import { DEPOSIT_LENDER, DEPOSIT_LENDER_LONG, DEPOSIT_MARGIN_DAYS } from '$lib/config';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, submitting } = superForm(
		data.form,
		formToasts({ created: 'Dépôt créé' })
	);
	const open = $derived(data.deposits.filter((d) => !d.closedAt));
	const closed = $derived(data.deposits.filter((d) => d.closedAt));
</script>

<div class="grid gap-6 lg:grid-cols-[1fr_380px]">
	<div class="space-y-6">
		<div>
			<h1 class="text-2xl font-semibold">Dépôts de la {DEPOSIT_LENDER}</h1>
			<p class="mt-2 max-w-3xl text-sm text-muted-foreground">
				Les livres prêtés par la {DEPOSIT_LENDER_LONG} forment un dépôt à part, échangé à date fixe. À
				la réception, scannez l'étiquette de chaque livre : ce qu'on a vraiment reçu se compare ensuite
				à leur liste. Les familles les empruntent comme les nôtres, mais jamais au-delà de
				{DEPOSIT_MARGIN_DAYS} jours avant la date de retour. Le jour de l'échange, scannez ce qui repart
				; ce qu'on garde passe au dépôt suivant.
			</p>
		</div>

		{#if open.length === 0}
			<Card.Root>
				<Card.Content class="pt-6 text-sm text-muted-foreground">
					Aucun dépôt en cours. Créez-en un ci-contre le jour où la caisse arrive.
				</Card.Content>
			</Card.Root>
		{/if}

		{#each open as d (d.id)}
			<Card.Root>
				<Card.Header>
					<div class="flex flex-wrap items-start justify-between gap-2">
						<div>
							<Card.Title
								><a class="hover:underline" href="/deposits/{d.id}">{d.label}</a></Card.Title
							>
							<Card.Description>
								Reçu le {fmtDate(d.receivedOn)} · retour le {fmtDate(d.returnOn)}
							</Card.Description>
						</div>
						<div class="flex gap-2">
							<Button href="/books/new?deposit={d.id}" variant="secondary" size="sm"
								>Réceptionner</Button
							>
							<Button href="/deposits/{d.id}" size="sm">Ouvrir</Button>
						</div>
					</div>
				</Card.Header>
				<Card.Content class="space-y-3">
					<DepositProgress deposit={d} />
					<dl class="counts">
						<div>
							<dt>Dans le dépôt</dt>
							<dd>{d.active}</dd>
						</div>
						<div>
							<dt>Chez des familles</dt>
							<dd class={d.onLoan ? '' : 'calm'}>{d.onLoan}</dd>
						</div>
						<div>
							<dt>Rendus</dt>
							<dd class="calm">{d.returned}</dd>
						</div>
						{#if d.missing}<div>
								<dt>Perdus / retirés</dt>
								<dd class="warn">{d.missing}</dd>
							</div>{/if}
					</dl>
				</Card.Content>
			</Card.Root>
		{/each}

		{#if closed.length}
			<details>
				<summary class="cursor-pointer text-sm text-muted-foreground"
					>Dépôts clôturés ({closed.length})</summary
				>
				<div class="mt-3">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Dépôt</Table.Head>
								<Table.Head>Reçu le</Table.Head>
								<Table.Head>Rendu le</Table.Head>
								<Table.Head class="text-right">Rendus</Table.Head>
								<Table.Head class="text-right">Perdus</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each closed as d (d.id)}
								<Table.Row>
									<Table.Cell
										><a class="font-medium underline" href="/deposits/{d.id}">{d.label}</a
										></Table.Cell
									>
									<Table.Cell>{fmtDate(d.receivedOn)}</Table.Cell>
									<Table.Cell>{fmtDate(d.closedAt)}</Table.Cell>
									<Table.Cell class="text-right">{d.returned}</Table.Cell>
									<Table.Cell class="text-right">{d.missing || ''}</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			</details>
		{/if}
	</div>

	<div class="space-y-6">
		<Card.Root>
			<Card.Header>
				<Card.Title>Nouveau dépôt</Card.Title>
				<Card.Description>Le jour de l'échange, avant de scanner la caisse.</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="post" action="?/create" use:enhance class="space-y-3" data-no-wedge>
					<div class="space-y-1">
						<Label for="label">Nom</Label>
						<Input id="label" name="label" bind:value={$form.label} />
						{#if $errors.label}<p class="text-sm text-destructive">{$errors.label}</p>{/if}
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<Label for="receivedOn">Reçu le</Label>
							<Input id="receivedOn" name="receivedOn" type="date" bind:value={$form.receivedOn} />
							{#if $errors.receivedOn}<p class="text-sm text-destructive">
									{$errors.receivedOn}
								</p>{/if}
						</div>
						<div class="space-y-1">
							<Label for="returnOn">Retour le</Label>
							<Input id="returnOn" name="returnOn" type="date" bind:value={$form.returnOn} />
							{#if $errors.returnOn}<p class="text-sm text-destructive">{$errors.returnOn}</p>{/if}
						</div>
					</div>
					<div class="space-y-1">
						<Label for="notes">Notes</Label>
						<Textarea id="notes" name="notes" bind:value={$form.notes} rows={2} />
					</div>
					<Button type="submit" disabled={$submitting}>Créer le dépôt</Button>
				</form>
			</Card.Content>
		</Card.Root>
		{#if open.length}
			<p class="text-xs text-muted-foreground">
				<Badge variant="outline">Astuce</Badge> Un livre scanné à la réception d'un nouveau dépôt alors
				qu'il est encore dans l'ancien passe automatiquement dans le nouveau : c'est ainsi qu'on garde
				des livres d'un échange à l'autre.
			</p>
		{/if}
	</div>
</div>

<style>
	.counts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.6rem;
		margin: 0;
	}
	.counts dt {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted-foreground);
	}
	.counts dd {
		margin: 0.05rem 0 0;
		font-family: 'Quicksand Variable', 'Quicksand', sans-serif;
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--c-secondary);
	}
	.counts dd.calm {
		color: var(--muted-foreground);
	}
	.counts dd.warn {
		color: var(--destructive);
	}
</style>
