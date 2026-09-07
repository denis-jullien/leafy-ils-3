<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { superForm } from 'sveltekit-superforms';
	import { enhanceToasts, formToasts, toast } from '$lib/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import DepositProgress from '$lib/components/DepositProgress.svelte';
	import { KeyboardWedgeSource, type ScanEvent } from '$lib/scan';
	import type { DepositBookState, ReturnResult } from '$lib/server/deposits';
	import { fmtDate, isOverdue } from '$lib/format';
	import { DEPOSIT_LENDER, DEPOSIT_MARGIN_DAYS } from '$lib/config';

	let { data, form: actionData } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance: saveEnhance, submitting } = superForm(data.form, formToasts());

	const d = $derived(data.deposit);
	const isOpen = $derived(!d.closedAt);
	const out = $derived(data.rows.filter((r) => r.state === 'loan'));
	const tiles = $derived([
		{ label: 'Dans le dépôt', n: d.active, tone: '' },
		{ label: 'Chez des familles', n: d.onLoan, tone: d.onLoan ? 'warn' : 'calm' },
		{ label: `Rendus à la ${DEPOSIT_LENDER}`, n: d.returned, tone: 'calm' },
		{ label: 'Perdus ou retirés', n: d.missing, tone: d.missing ? 'warn' : 'calm' }
	]);
	const STATE_LABEL: Record<DepositBookState, string> = {
		shelf: 'en rayon',
		loan: 'chez une famille',
		returned: 'rendu',
		lost: 'perdu',
		withdrawn: 'retiré'
	};

	/* ---- Packing the crate: every sticker scanned goes back to the lender ---- */
	type LogEntry = { id: number; tone: 'ok' | 'warn' | 'err' | 'info'; text: string };
	let packing = $state(false);
	let scan = $state('');
	let busy = $state(false);
	let log = $state<LogEntry[]>([]);
	let logSeq = 0;
	const say = (tone: LogEntry['tone'], text: string) =>
		(log = [{ id: ++logSeq, tone, text }, ...log].slice(0, 40));

	async function pack(code: string) {
		code = code.trim();
		if (!code || busy) return;
		busy = true;
		try {
			const res = await fetch(`/api/deposits/${d.id}/return`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ barcode: code })
			});
			const r = (await res.json()) as ReturnResult & { error?: string };
			if (!res.ok) throw new Error(r.error ?? 'Scan impossible');
			switch (r.kind) {
				case 'returned':
					say(
						'ok',
						`Dans la caisse : « ${r.book.title} »${r.from ? ` (venait du dépôt ${r.from.label})` : ''}`
					);
					await invalidateAll();
					break;
				case 'already':
					say('info', `« ${r.book.title} » est déjà dans la caisse`);
					break;
				case 'on_loan':
					say(
						'warn',
						`« ${r.book.title} » est encore chez ${r.family.name} (retour prévu le ${fmtDate(r.dueAt)})`
					);
					toast.warning(`Encore chez ${r.family.name}`, { description: r.book.title });
					break;
				case 'own':
					say('err', `« ${r.book.title} » est un livre de la bibliothèque, pas du dépôt`);
					toast.error('Livre de la bibliothèque', { description: r.book.title });
					break;
				case 'unknown':
					say('err', `Étiquette inconnue : ${r.barcode}`);
					toast.error(`Étiquette inconnue : ${r.barcode}`);
					break;
				case 'isbn':
					say('warn', `${r.isbn} est un ISBN : scannez l'étiquette de la ${DEPOSIT_LENDER}`);
					toast.warning("C'est l'ISBN", { description: "Scannez l'étiquette de la médiathèque." });
					break;
			}
		} catch (err) {
			say('err', (err as Error).message);
			toast.error((err as Error).message);
		} finally {
			busy = false;
		}
	}

	function onScanKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const code = scan;
		scan = '';
		void pack(code);
	}

	onMount(() => {
		// A scanner in keyboard mode, wherever the focus is, once packing has started.
		const scanner = new KeyboardWedgeSource();
		scanner.start((ev: ScanEvent) => {
			if (packing) void pack(ev.code);
		});
		return () => scanner.stop();
	});
</script>

<div class="space-y-6">
	<div>
		<a class="text-sm text-muted-foreground hover:underline" href="/deposits">← Dépôts</a>
		<div class="mt-1 flex flex-wrap items-start justify-between gap-3">
			<div class="min-w-0">
				<h1 class="flex flex-wrap items-center gap-2 text-2xl font-semibold">
					{d.label}
					{#if !isOpen}<Badge variant="secondary">clôturé le {fmtDate(d.closedAt)}</Badge>{/if}
				</h1>
				<p class="text-sm text-muted-foreground">
					Reçu le {fmtDate(d.receivedOn)} · retour prévu le {fmtDate(d.returnOn)}
					{#if isOpen}
						· prêts aux familles jusqu'au {fmtDate(data.loanCap)} au plus tard
					{/if}
				</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<Button href="/books?orig={d.id}" variant="outline">Dans la liste des livres</Button>
				{#if isOpen}
					<Button href="/books/new?deposit={d.id}">Réceptionner des livres</Button>
				{/if}
			</div>
		</div>
		{#if isOpen}<div class="mt-3 max-w-2xl"><DepositProgress deposit={d} /></div>{/if}
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each tiles as { label, n, tone } (label)}
			<Card.Root class="desk-tile desk-tile-{tone}">
				<Card.Header>
					<Card.Description>{label}</Card.Description>
					<Card.Title class="text-3xl">{n}</Card.Title>
				</Card.Header>
			</Card.Root>
		{/each}
	</div>

	{#if actionData && 'error' in actionData && actionData.error}
		<p class="text-sm text-destructive">{actionData.error}</p>
	{/if}

	<div class="grid gap-6 lg:grid-cols-[1fr_400px]">
		<div class="space-y-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Encore chez des familles ({out.length})</Card.Title>
					<Card.Description>
						À récupérer avant le retour : leur date de prêt est déjà bornée à {DEPOSIT_MARGIN_DAYS} jours
						avant.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if out.length === 0}
						<p class="text-sm text-muted-foreground">Tout est en rayon.</p>
					{:else}
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>Livre</Table.Head>
									<Table.Head>Famille</Table.Head>
									<Table.Head>Téléphone</Table.Head>
									<Table.Head>À rendre le</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each out as r (r.book.id)}
									<Table.Row>
										<Table.Cell
											><a class="underline" href="/books/{r.book.id}">{r.book.title}</a></Table.Cell
										>
										<Table.Cell
											><a class="underline" href="/families/{r.loan?.family.id}"
												>{r.loan?.family.name}</a
											></Table.Cell
										>
										<Table.Cell>{r.loan?.family.phone ?? ''}</Table.Cell>
										<Table.Cell class={r.loan && isOverdue(r.loan.dueAt) ? 'text-destructive' : ''}
											>{fmtDate(r.loan?.dueAt)}</Table.Cell
										>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Livres du dépôt ({data.rows.length})</Card.Title>
					<Card.Description
						>Ce qui a été scanné à la réception, et où chaque livre en est.</Card.Description
					>
				</Card.Header>
				<Card.Content>
					{#if data.rows.length === 0}
						<p class="text-sm text-muted-foreground">
							Rien encore. <a class="underline" href="/books/new?deposit={d.id}"
								>Scannez les livres de la caisse</a
							> pour les enregistrer.
						</p>
					{:else}
						<Table.Root class="table-fixed">
							<Table.Header>
								<Table.Row>
									<Table.Head class="w-[52%]">Livre</Table.Head>
									<Table.Head class="w-[20%]">Étiquette</Table.Head>
									<Table.Head class="w-[28%]">État</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each data.rows as r (r.book.id)}
									<Table.Row>
										<Table.Cell class="cell-wrap">
											<a class="font-medium underline" href="/books/{r.book.id}">{r.book.title}</a>
											{#if r.book.authors}<span class="text-muted-foreground">
													· {r.book.authors}</span
												>{/if}
										</Table.Cell>
										<Table.Cell class="font-mono text-xs">{r.book.barcode ?? ''}</Table.Cell>
										<Table.Cell>
											{#if r.state === 'loan'}
												<Badge variant="secondary">chez {r.loan?.family.name}</Badge>
											{:else if r.state === 'shelf'}
												<span class="text-muted-foreground">{STATE_LABEL[r.state]}</span>
											{:else if r.state === 'returned'}
												<Badge variant="outline">{STATE_LABEL[r.state]}</Badge>
											{:else}
												<Badge variant="destructive">{STATE_LABEL[r.state]}</Badge>
											{/if}
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>

		<div class="space-y-6">
			{#if isOpen}
				<Card.Root>
					<Card.Header>
						<Card.Title>Retour à la {DEPOSIT_LENDER}</Card.Title>
						<Card.Description>
							Le jour de l'échange : scannez l'étiquette de chaque livre remis dans la caisse. Un
							livre encore chez une famille est signalé, pas rendu.
						</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-3">
						{#if !packing}
							<Button class="w-full" variant="secondary" onclick={() => (packing = true)}
								>Commencer à remplir la caisse</Button
							>
						{:else}
							<Input
								bind:value={scan}
								onkeydown={onScanKeydown}
								placeholder="Scannez l'étiquette du livre"
								class="desk-scan font-mono"
								autofocus
								autocomplete="off"
								data-no-wedge
							/>
							<p class="text-sm">
								<strong>{d.returned}</strong> rendu{d.returned > 1 ? 's' : ''} ·
								<strong>{d.active - d.onLoan}</strong> encore en rayon ·
								<strong>{d.onLoan}</strong> chez des familles
							</p>
							<ul class="max-h-56 space-y-1 overflow-y-auto text-sm">
								{#each log as e (e.id)}
									<li
										class={e.tone === 'err'
											? 'text-destructive'
											: e.tone === 'warn'
												? 'text-amber-700'
												: e.tone === 'ok'
													? 'text-green-700'
													: 'text-muted-foreground'}
									>
										{e.text}
									</li>
								{/each}
							</ul>
						{/if}

						<form
							method="post"
							action="?/close"
							use:enhance={enhanceToasts('Dépôt clôturé')}
							class="space-y-2 border-t pt-3"
							onsubmit={(e) => {
								const left = d.active;
								const msg = left
									? `Clôturer « ${d.label} » ? Les ${left} livre(s) encore ici passeront dans le dépôt choisi.`
									: `Clôturer « ${d.label} » ?`;
								if (!confirm(msg)) e.preventDefault();
							}}
						>
							{#if d.active > 0}
								<Label for="moveTo">
									{d.active} livre{d.active > 1 ? 's' : ''} reste{d.active > 1 ? 'nt' : ''} ici ({d.onLoan}
									chez des familles) : ils passent dans
								</Label>
								<select
									id="moveTo"
									name="moveTo"
									required
									class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
								>
									<option value="">— choisir le dépôt qui les garde —</option>
									{#each data.others as o (o.id)}
										<option value={o.id}>{o.label} (retour le {fmtDate(o.returnOn)})</option>
									{/each}
								</select>
								{#if data.others.length === 0}
									<p class="text-xs text-muted-foreground">
										Créez d'abord le nouveau dépôt depuis la page <a
											class="underline"
											href="/deposits">Dépôts</a
										>.
									</p>
								{/if}
							{/if}
							<Button
								type="submit"
								variant="outline"
								class="w-full"
								disabled={d.active > 0 && data.others.length === 0}>Clôturer le dépôt</Button
							>
						</form>
					</Card.Content>
				</Card.Root>
			{/if}

			<Card.Root>
				<Card.Header>
					<Card.Title>Vérifier avec leur liste</Card.Title>
					<Card.Description>
						Collez la liste fournie par la {DEPOSIT_LENDER} (texte ou tableur, une ligne par livre) :
						on la compare à ce qui a été scanné ici.
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-3">
					<form
						method="post"
						action="?/compare"
						use:enhance={() => {
							busy = true;
							return async ({ update }) => {
								busy = false;
								await update({ reset: false });
							};
						}}
						class="space-y-2"
						data-no-wedge
					>
						<Textarea name="list" rows={5} class="font-mono text-xs" placeholder="Code;Titre;…" />
						<Button type="submit" variant="secondary" disabled={busy}>Comparer</Button>
					</form>
					{#if actionData && 'comparison' in actionData && actionData.comparison}
						{@const c = actionData.comparison}
						<div class="space-y-2 text-sm">
							<p>
								Leur liste : <strong>{c.theirs}</strong> livre{c.theirs > 1 ? 's' : ''}, dont
								<strong>{c.matched}</strong> retrouvé{c.matched > 1 ? 's' : ''} ici.
							</p>
							{#if c.missing.length === 0 && c.extra.length === 0}
								<p class="text-green-700">Tout concorde.</p>
							{/if}
							{#if c.missing.length}
								<p class="font-medium">Sur leur liste, pas scannés ici ({c.missing.length}) :</p>
								<ul class="max-h-40 list-disc overflow-y-auto pl-5 font-mono text-xs">
									{#each c.missing as line, i (i)}<li>{line}</li>{/each}
								</ul>
							{/if}
							{#if c.extra.length}
								<p class="font-medium">Scannés ici, absents de leur liste ({c.extra.length}) :</p>
								<ul class="max-h-40 list-disc overflow-y-auto pl-5 text-xs">
									{#each c.extra as b (b.id)}
										<li>
											<a class="underline" href="/books/{b.id}">{b.title}</a>
											{#if b.barcode}<span class="font-mono text-muted-foreground">
													{b.barcode}</span
												>{/if}
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header><Card.Title>Dates et notes</Card.Title></Card.Header>
				<Card.Content>
					<form method="post" action="?/save" use:saveEnhance class="space-y-3" data-no-wedge>
						<div class="space-y-1">
							<Label for="label">Nom</Label>
							<Input id="label" name="label" bind:value={$form.label} />
							{#if $errors.label}<p class="text-sm text-destructive">{$errors.label}</p>{/if}
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-1">
								<Label for="receivedOn">Reçu le</Label>
								<Input
									id="receivedOn"
									name="receivedOn"
									type="date"
									bind:value={$form.receivedOn}
								/>
							</div>
							<div class="space-y-1">
								<Label for="returnOn">Retour le</Label>
								<Input id="returnOn" name="returnOn" type="date" bind:value={$form.returnOn} />
								{#if $errors.returnOn}<p class="text-sm text-destructive">
										{$errors.returnOn}
									</p>{/if}
							</div>
						</div>
						<div class="space-y-1">
							<Label for="notes">Notes</Label>
							<Textarea id="notes" name="notes" bind:value={$form.notes} rows={2} />
						</div>
						<Button type="submit" disabled={$submitting}>Enregistrer</Button>
					</form>
					{#if data.rows.length === 0}
						<form
							method="post"
							action="?/remove"
							use:enhance={enhanceToasts('Dépôt supprimé')}
							class="mt-3 border-t pt-3 text-right"
							onsubmit={(e) => {
								if (!confirm(`Supprimer le dépôt « ${d.label} » ?`)) e.preventDefault();
							}}
						>
							<Button type="submit" variant="ghost" class="text-destructive"
								>Supprimer ce dépôt</Button
							>
						</form>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
