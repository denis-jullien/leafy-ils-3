<script lang="ts">
	/**
	 * Propose a shelf for every unshelved book with the local model, let the
	 * volunteer review, then apply through the quick-edit endpoint.
	 */
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { localModel } from '$lib/embed/local-model.svelte';
	import {
		confidenceLabel,
		loadShelfContext,
		proposeShelfLocally,
		type LocalProposal
	} from '$lib/embed/classify';

	type Row = {
		id: number;
		title: string;
		authors: string | null;
		proposal: LocalProposal | null;
		apply: boolean;
		done?: 'ok' | 'error';
	};

	let rows = $state<Row[]>([]);
	let phase = $state<'idle' | 'classifying' | 'review' | 'applying' | 'done'>('idle');
	let progress = $state(0);
	let total = $state(0);
	let error = $state('');

	async function classify() {
		phase = 'classifying';
		error = '';
		rows = [];
		try {
			const [{ books }, ctx] = await Promise.all([
				fetch('/api/books/unshelved').then((r) => r.json()),
				loadShelfContext(true)
			]);
			total = books.length;
			progress = 0;
			const out: Row[] = [];
			for (const b of books) {
				const proposal = await proposeShelfLocally(
					{
						title: b.title,
						authors: b.authors,
						publisher: b.publisher,
						description: b.description
					},
					ctx
				);
				out.push({
					id: b.id,
					title: b.title,
					authors: b.authors,
					proposal,
					apply: !!proposal && proposal.confidence !== 'unsure'
				});
				progress++;
				rows = out;
			}
			phase = 'review';
		} catch (err) {
			error = (err as Error).message;
			phase = 'idle';
		}
	}

	async function apply() {
		phase = 'applying';
		for (const r of rows) {
			if (!r.apply || !r.proposal) continue;
			const res = await fetch(`/api/books/${r.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ shelfId: r.proposal.shelfId })
			});
			r.done = res.ok ? 'ok' : 'error';
		}
		phase = 'done';
		await invalidateAll();
	}

	const selected = $derived(rows.filter((r) => r.apply && r.proposal).length);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Ranger les livres sans rayon</Card.Title>
		<Card.Description>
			Le modèle local propose un rayon pour chaque livre sans rayon ; vous vérifiez, puis vous
			appliquez.
		</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-3">
		{#if !localModel.enabled}
			<p class="text-sm text-muted-foreground">Activez d'abord le modèle local ci-dessus.</p>
		{:else if phase === 'idle' || phase === 'done'}
			<Button onclick={classify}>{phase === 'done' ? 'Recommencer' : 'Proposer des rayons'}</Button>
			{#if phase === 'done'}
				<p class="text-sm text-green-700">
					{rows.filter((r) => r.done === 'ok').length} livre(s) rangé(s).
				</p>
			{/if}
		{:else if phase === 'classifying'}
			<p class="text-sm text-muted-foreground">
				{localModel.status === 'loading'
					? `Chargement du modèle… ${localModel.progress}%`
					: `Analyse ${progress} / ${total}…`}
			</p>
		{/if}
		{#if error}<p class="text-sm text-destructive">{error}</p>{/if}

		{#if rows.length && (phase === 'review' || phase === 'applying' || phase === 'done')}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head></Table.Head>
						<Table.Head>Livre</Table.Head>
						<Table.Head>Rayon proposé</Table.Head>
						<Table.Head>Confiance</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each rows as r (r.id)}
						<Table.Row>
							<Table.Cell>
								<input
									type="checkbox"
									class="size-4"
									bind:checked={r.apply}
									disabled={!r.proposal || phase !== 'review'}
								/>
							</Table.Cell>
							<Table.Cell>
								<a class="underline" href="/books/{r.id}">{r.title}</a>
								{#if r.authors}<span class="text-muted-foreground"> · {r.authors}</span>{/if}
							</Table.Cell>
							<Table.Cell>
								{#if r.proposal}
									{r.proposal.shelfName}
									{#if r.proposal.runnerUpName}<span class="text-xs text-muted-foreground">
											(sinon {r.proposal.runnerUpName})</span
										>{/if}
								{:else}<em class="text-muted-foreground">aucun</em>{/if}
							</Table.Cell>
							<Table.Cell>
								{#if r.done === 'ok'}<Badge>rangé</Badge>
								{:else if r.done === 'error'}<Badge variant="destructive">erreur</Badge>
								{:else if r.proposal}
									<Badge
										variant={r.proposal.confidence === 'sure'
											? 'default'
											: r.proposal.confidence === 'likely'
												? 'secondary'
												: 'outline'}
									>
										{confidenceLabel[r.proposal.confidence]}
									</Badge>
								{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
			{#if phase === 'review'}
				<Button onclick={apply} disabled={selected === 0}>Appliquer {selected} rayon(s)</Button>
			{:else if phase === 'applying'}
				<p class="text-sm text-muted-foreground">Enregistrement…</p>
			{/if}
		{/if}
	</Card.Content>
</Card.Root>
