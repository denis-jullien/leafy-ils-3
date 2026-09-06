<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import DailyChart from '$lib/components/DailyChart.svelte';
	import { fmtDate, fmtRelative } from '$lib/format';
	import { BookDown, BookPlus, BookUp, UserPlus } from '@lucide/svelte';
	import type { ActivityGroup } from '$lib/server/stats';

	let { data } = $props();
	const s = $derived(data.stats);
	const tiles = $derived([
		{ label: 'Livres au catalogue', n: s.books, href: '/books', tone: '' },
		{ label: 'Familles inscrites', n: s.families, href: '/families', tone: '' },
		{ label: 'En prêt', n: s.onLoan, href: '/circulation', tone: '' },
		{ label: 'En retard', n: s.overdue, href: '#retards', tone: s.overdue ? 'warn' : 'calm' }
	]);
	const activeDays = $derived(data.days.length);
	const totalLoans = $derived(data.days.reduce((n, d) => n + d.loans, 0));
	const perDay = $derived(activeDays ? (totalLoans / activeDays).toFixed(1) : '–');
	const record = $derived(
		data.days.reduce((m, d) => (d.loans > m.loans ? d : m), { loans: 0, day: '' })
	);
	const topMax = $derived(Math.max(1, ...data.top.map((t) => t.n)));

	const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n > 1 ? p : s}`;
	const icons = { loan: BookUp, return: BookDown, book: BookPlus, family: UserPlus };
	/** What a group says, in two parts: the bold count and the rest. */
	function headline(g: ActivityGroup): { strong: string; rest: string } {
		const n = g.books.length;
		switch (g.kind) {
			case 'loan':
				return { strong: plural(n, 'livre'), rest: n > 1 ? 'prêtés à' : 'prêté à' };
			case 'return':
				return { strong: plural(n, 'livre'), rest: n > 1 ? 'rendus par' : 'rendu par' };
			case 'book':
				return {
					strong: plural(n, 'livre'),
					rest: n > 1 ? 'ajoutés au catalogue' : 'ajouté au catalogue'
				};
			case 'family':
				return g.families.length > 1
					? { strong: plural(g.families.length, 'famille'), rest: 'inscrites' }
					: { strong: 'Nouvelle famille', rest: '' };
		}
	}
	const titles = (g: ActivityGroup) => {
		const shown = g.books.slice(0, 3).map((b) => b.title);
		const more = g.books.length - shown.length;
		return shown.join(' · ') + (more > 0 ? ` · et ${plural(more, 'autre')}` : '');
	};
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">Tableau de bord</h1>
		<Button href="/circulation" size="lg">Commencer les prêts</Button>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each tiles as { label, n, href, tone } (label)}
			<a {href}>
				<Card.Root class="desk-tile desk-tile-{tone}">
					<Card.Header>
						<Card.Description>{label}</Card.Description>
						<Card.Title class="text-3xl">{n}</Card.Title>
					</Card.Header>
				</Card.Root>
			</a>
		{/each}
	</div>

	<div class="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
		<Card.Root>
			<Card.Header>
				<Card.Title>Prêts par jour d'ouverture</Card.Title>
				<Card.Description
					>Les {activeDays} derniers jours où quelque chose s'est passé au comptoir.</Card.Description
				>
			</Card.Header>
			<Card.Content class="space-y-5">
				<DailyChart days={data.days} />
				<dl class="figures">
					<div>
						<dt>Prêts sur 30 jours</dt>
						<dd>{s.loans30}</dd>
					</div>
					<div>
						<dt>Moyenne par jour d'ouverture</dt>
						<dd>{perDay}</dd>
					</div>
					<div>
						<dt>Record</dt>
						<dd>
							{record.loans}{#if record.day}<small>&nbsp;le {fmtDate(record.day)}</small>{/if}
						</dd>
					</div>
					<div>
						<dt>Familles actives (90 j)</dt>
						<dd>{s.activeFamilies}</dd>
					</div>
				</dl>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Les plus empruntés</Card.Title>
				<Card.Description>Depuis le début.</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if data.top.length === 0}
					<p class="text-sm text-muted-foreground">
						Rien encore : le premier prêt fera le premier classement.
					</p>
				{:else}
					<ol class="top">
						{#each data.top as t, i (t.id)}
							<li>
								<span class="rank">{i + 1}</span>
								<div class="min-w-0 flex-1">
									<a class="title" href="/books/{t.id}">{t.title}</a>
									{#if t.authors}<div class="author">{t.authors}</div>{/if}
									<div class="track">
										<div class="fill" style:width="{(t.n / topMax) * 100}%"></div>
									</div>
								</div>
								<span class="count">{t.n}</span>
							</li>
						{/each}
					</ol>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Au comptoir récemment</Card.Title>
				<Card.Description>Prêts, retours, nouveautés et inscriptions.</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if data.activity.length === 0}
					<p class="text-sm text-muted-foreground">Rien encore. Le premier prêt s'affichera ici.</p>
				{:else}
					<ol class="feed">
						{#each data.activity as g, i (i)}
							{@const h = headline(g)}
							{@const Icon = icons[g.kind]}
							<li class="feed-{g.kind}">
								<span class="dot"><Icon class="size-4" /></span>
								<div class="min-w-0 flex-1">
									<p class="line">
										<strong>{h.strong}</strong>
										{h.rest}
										{#if g.kind === 'loan' || g.kind === 'return'}
											<a class="who" href="/families/{g.family?.id}">{g.family?.name}</a>
										{:else if g.kind === 'family'}
											{#each g.families as f, j (f.id)}{#if j > 0},
												{/if}<a class="who" href="/families/{f.id}">{f.name}</a>{/each}
										{/if}
									</p>
									{#if g.books.length}<p class="titles">{titles(g)}</p>{/if}
									<p class="when">
										{fmtRelative(g.at)}{#if g.by}&nbsp;· par {g.by}{/if}
									</p>
								</div>
							</li>
						{/each}
					</ol>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root id="retards">
			<Card.Header>
				<Card.Title>Retards ({data.overdue.length})</Card.Title>
			</Card.Header>
			<Card.Content>
				{#if data.overdue.length === 0}
					<p class="text-sm text-muted-foreground">Aucun retard. Quel village.</p>
				{:else}
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Livre</Table.Head>
								<Table.Head>Famille</Table.Head>
								<Table.Head>À rendre le</Table.Head>
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
</div>

<style>
	.figures {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.8rem;
		border-top: 1px solid var(--line);
		padding-top: 1rem;
		margin: 0;
	}
	.figures dt {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted-foreground);
	}
	.figures dd {
		margin: 0.1rem 0 0;
		font-family: 'Quicksand Variable', 'Quicksand', sans-serif;
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--c-secondary);
	}
	.figures dd small {
		font-family: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--muted-foreground);
	}

	.top {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.top li {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.rank {
		flex: none;
		width: 1.8rem;
		height: 1.8rem;
		border-radius: 999px;
		display: grid;
		place-items: center;
		font-weight: 800;
		font-size: 0.8rem;
		background: var(--surface-alt);
		color: var(--c-secondary);
	}
	.top li:first-child .rank {
		background: var(--c-accent);
		color: var(--ink);
	}
	.top .title {
		display: block;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.top .title:hover {
		text-decoration: underline;
	}
	.top .author {
		font-size: 0.78rem;
		color: var(--muted-foreground);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.track {
		margin-top: 0.35rem;
		height: 5px;
		border-radius: 999px;
		background: var(--muted);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--c-secondary), var(--c-primary));
	}
	.count {
		flex: none;
		font-family: 'Quicksand Variable', 'Quicksand', sans-serif;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--c-secondary);
	}

	.feed {
		list-style: none;
		margin: 0;
		padding: 0 0.25rem 0 0;
		position: relative;
		max-height: 34rem;
		overflow-y: auto;
	}
	.feed::before {
		content: '';
		position: absolute;
		left: 0.95rem;
		top: 1rem;
		bottom: 1rem;
		width: 2px;
		background: var(--line);
	}
	.feed li {
		position: relative;
		display: flex;
		gap: 0.9rem;
		padding: 0.55rem 0;
	}
	.dot {
		flex: none;
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		display: grid;
		place-items: center;
		border: 2px solid var(--card);
		box-shadow: 0 0 0 2px var(--line);
		background: var(--surface-alt);
		color: var(--c-secondary);
	}
	.feed-loan .dot {
		background: var(--c-primary);
		color: #fff;
	}
	.feed-return .dot {
		background: color-mix(in srgb, var(--c-accent) 55%, #fff);
		color: var(--ink);
	}
	.feed-family .dot {
		background: var(--ink);
		color: var(--bg);
	}
	.line {
		margin: 0.25rem 0 0;
		font-size: 0.95rem;
		line-height: 1.35;
	}
	.who {
		font-weight: 700;
		color: var(--c-secondary);
	}
	.who:hover {
		text-decoration: underline;
	}
	.titles {
		margin: 0.15rem 0 0;
		font-size: 0.82rem;
		color: var(--muted-foreground);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.when {
		margin: 0.15rem 0 0;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--muted-foreground);
	}
</style>
