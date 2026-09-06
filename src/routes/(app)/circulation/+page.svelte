<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import ScannerPanel from '$lib/components/ScannerPanel.svelte';
	import { Scanners } from '$lib/scan/use-scanners.svelte';
	import type { ScanEvent } from '$lib/scan';
	import type { OpenLoan, Resolved } from '$lib/server/circulation';
	import type { Book } from '$lib/server/db/schema';
	import type { FamilyHit } from '$lib/server/families';
	import { fmtDate, isOverdue } from '$lib/format';
	import { parseIsbn } from '$lib/isbn';
	import { BOOK_STATUS } from '$lib/labels';
	import { toast } from '$lib/toast';

	let { data } = $props();

	type FamilyState = Extract<Resolved, { kind: 'family' }>;
	type LogEntry = { id: number; tone: 'ok' | 'warn' | 'err' | 'info'; text: string; href?: string };

	let family = $state<FamilyState | null>(null);
	let basket = $state<Book[]>([]);
	/** Books scanned while on loan: returned only when the volunteer validates. */
	let returns = $state<{ book: Book; loan: OpenLoan }[]>([]);
	let log = $state<LogEntry[]>([]);
	let manual = $state('');
	let busy = $state(false);
	let logSeq = 0;

	// Family finder: typing letters in the input searches families by name.
	let suggestions = $state<FamilyHit[]>([]);
	let highlighted = $state(0);
	let searchSeq = 0;
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	const scanners = new Scanners();

	function say(tone: LogEntry['tone'], text: string, href?: string) {
		log = [{ id: ++logSeq, tone, text, href }, ...log].slice(0, 30);
	}

	async function resolve(code: string): Promise<Resolved> {
		const res = await fetch(`/api/scan/${encodeURIComponent(code)}`);
		if (!res.ok) throw new Error(`Recherche impossible (${res.status})`);
		return res.json();
	}

	/** Reload the selected family's loans. Never drops the selection, even if the reload fails. */
	async function refreshFamily() {
		if (!family?.family.barcode) return;
		try {
			const r = await resolve(family.family.barcode);
			if (r.kind === 'family') family = r;
		} catch {
			/* keep what we have */
		}
	}

	/** Every scan, keypress-entered code or manual entry ends up here. */
	async function handleCode(code: string) {
		code = code.trim();
		if (!code || busy) return;
		busy = true;
		try {
			const r = await resolve(code);
			if (r.kind === 'family') {
				family = r;
				say('info', `${r.family.name} : ${r.openLoans.length} livre(s) en prêt`);
				toast.info(`Famille : ${r.family.name}`, {
					description: `${r.openLoans.length} livre(s) en prêt`,
					duration: 2000
				});
				if (r.family.status !== 'active') say('warn', `${r.family.name} n'est pas un abonné actif`);
				return;
			}
			if (r.kind === 'book') {
				const { book, openLoan } = r;
				if (openLoan) {
					if (returns.some((r) => r.loan.id === openLoan.id)) {
						say('info', `« ${book.title} » est déjà dans les retours`);
						return;
					}
					returns = [...returns, { book, loan: openLoan }];
					const late = isOverdue(openLoan.dueAt) ? ', en retard' : '';
					say(
						'ok',
						`À rendre : « ${book.title} » (${openLoan.family.name}${late})`,
						`/books/${book.id}`
					);
					await selectFamilyForReturn(openLoan);
					return;
				}
				if (book.status !== 'active') {
					say(
						'warn',
						`« ${book.title} » est marqué ${BOOK_STATUS[book.status]}`,
						`/books/${book.id}`
					);
					return;
				}
				if (basket.some((b) => b.id === book.id)) {
					say('info', `« ${book.title} » est déjà dans le panier`);
					return;
				}
				basket = [...basket, book];
				say('ok', `Ajouté : « ${book.title} »`, `/books/${book.id}`);
				return;
			}
			const isbn = parseIsbn(code);
			if (isbn) {
				say(
					'warn',
					`Pas au catalogue : ${isbn}. Cliquez pour l'ajouter.`,
					`/books/new?isbn=${isbn}`
				);
				toast.warning('Livre inconnu au catalogue', {
					description: isbn,
					action: { label: 'Ajouter', onClick: () => (location.href = `/books/new?isbn=${isbn}`) }
				});
			} else {
				say('err', `Code inconnu : ${code}`);
				toast.error(`Code inconnu : ${code}`);
			}
		} catch (err) {
			say('err', (err as Error).message);
			toast.error((err as Error).message);
		} finally {
			busy = false;
		}
	}

	async function checkout() {
		if (!family || basket.length === 0) return;
		busy = true;
		try {
			const res = await fetch('/api/loans', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ familyId: family.family.id, bookIds: basket.map((b) => b.id) })
			});
			const body = await res.json();
			if (!res.ok) throw new Error(body.error ?? 'Prêt impossible');
			const due = fmtDate(body.loans[0].dueAt);
			say('ok', `${basket.length} livre(s) prêté(s) à ${family.family.name}, retour le ${due}`);
			toast.success(`${basket.length} livre(s) prêté(s) à ${family.family.name}`, {
				description: `À rendre le ${due}`
			});
			basket = [];
			await refreshFamily();
			await invalidateAll(); // pages preloaded on hover must not show pre-loan data
		} catch (err) {
			say('err', (err as Error).message);
			toast.error((err as Error).message);
		} finally {
			busy = false;
		}
	}

	/** Letters mean a name; digits, ISBNs and labels mean a code. */
	const looksLikeName = (text: string) => /\p{L}{2,}/u.test(text) && !parseIsbn(text);

	async function searchFamilies(q: string): Promise<FamilyHit[]> {
		const res = await fetch(`/api/families?q=${encodeURIComponent(q)}`);
		return res.ok ? res.json() : [];
	}

	function onManualInput() {
		const text = manual.trim();
		if (searchTimer) clearTimeout(searchTimer);
		if (!looksLikeName(text)) {
			suggestions = [];
			return;
		}
		const seq = ++searchSeq;
		searchTimer = setTimeout(async () => {
			const hits = await searchFamilies(text);
			if (seq !== searchSeq) return; // a newer keystroke won
			suggestions = hits;
			highlighted = 0;
		}, 120);
	}

	function clearSearch() {
		searchSeq++;
		suggestions = [];
		manual = '';
	}

	async function selectFamily(hit: FamilyHit) {
		clearSearch();
		if (!hit.barcode) return;
		await handleCode(hit.barcode);
	}

	/** Enter on a name: pick the highlighted match, or search now if the list is not up yet. */
	async function submitName(text: string) {
		if (suggestions.length > 0) {
			await selectFamily(suggestions[highlighted] ?? suggestions[0]);
			return;
		}
		const hits = await searchFamilies(text);
		if (hits.length === 1) await selectFamily(hits[0]);
		else if (hits.length > 1) {
			suggestions = hits;
			highlighted = 0;
		} else {
			clearSearch();
			say('err', `Aucune famille ne correspond à « ${text} »`);
		}
	}

	/**
	 * A family bringing books back usually borrows next: a return selects its
	 * family when none is selected. An existing selection is never changed by a
	 * scan; only "Famille suivante" or picking a name does that.
	 */
	async function selectFamilyForReturn(loan: OpenLoan) {
		if (family) {
			if (family.family.id !== loan.familyId)
				say(
					'info',
					`Ce livre est à ${loan.family.name} (${family.family.name} reste sélectionnée)`
				);
			return;
		}
		if (!loan.family.barcode) return;
		const r = await resolve(loan.family.barcode);
		if (r.kind === 'family') {
			family = r;
			say('info', `Famille sélectionnée : ${r.family.name}`);
		}
	}

	async function validateReturns() {
		if (returns.length === 0) return;
		busy = true;
		try {
			const res = await fetch('/api/returns', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ loanIds: returns.map((r) => r.loan.id) })
			});
			const body = await res.json();
			if (!res.ok) throw new Error(body.error ?? 'Retour impossible');
			say('ok', `${returns.length} livre(s) rendu(s)`);
			toast.success(`${returns.length} livre(s) rendu(s)`);
			const familyId = family?.family.id;
			const touchesFamily =
				familyId !== undefined && returns.some((r) => r.loan.familyId === familyId);
			returns = [];
			if (touchesFamily) await refreshFamily();
			await invalidateAll();
		} catch (err) {
			say('err', (err as Error).message);
			toast.error((err as Error).message);
		} finally {
			busy = false;
		}
	}

	// Don't lose a half-finished pile of books to a stray click on the nav.
	const pending = $derived(basket.length + returns.length > 0);
	beforeNavigate((nav) => {
		if (pending && !confirm('Des livres attendent encore validation. Quitter quand même ?'))
			nav.cancel();
	});
	function onBeforeUnload(e: BeforeUnloadEvent) {
		if (pending) e.preventDefault();
	}

	function finish() {
		family = null;
		basket = [];
		say('info', 'Prêt pour la famille suivante');
	}

	function onManualKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' && suggestions.length) {
			e.preventDefault();
			highlighted = (highlighted + 1) % suggestions.length;
		} else if (e.key === 'ArrowUp' && suggestions.length) {
			e.preventDefault();
			highlighted = (highlighted - 1 + suggestions.length) % suggestions.length;
		} else if (e.key === 'Escape') {
			clearSearch();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const text = manual.trim();
			if (!text) return;
			if (looksLikeName(text)) {
				void submitName(text);
			} else {
				clearSearch();
				void handleCode(text);
			}
		}
	}

	onMount(() => {
		const cleanup = scanners.attach((ev: ScanEvent) => void handleCode(ev.code));
		if (data.initialCode) void handleCode(data.initialCode);
		return cleanup;
	});
</script>

<svelte:window onbeforeunload={onBeforeUnload} />

<div class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">Prêts &amp; retours</h1>
		<p class="text-sm text-muted-foreground">
			Scannez les livres rapportés, puis ceux à prêter. Le premier retour sélectionne la famille ;
			elle reste sélectionnée jusqu'à « Famille suivante ». Rien n'est enregistré avant d'avoir
			validé.
		</p>
	</div>

	<div class="relative">
		<Input
			bind:value={manual}
			oninput={onManualInput}
			onkeydown={onManualKeydown}
			placeholder="Nom de la famille, ou scannez un livre ici"
			class="desk-scan"
			autofocus
			autocomplete="off"
			role="combobox"
			aria-expanded={suggestions.length > 0}
			aria-controls="family-suggestions"
			data-no-wedge
		/>
		{#if suggestions.length > 0}
			<ul
				id="family-suggestions"
				role="listbox"
				class="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md"
			>
				{#each suggestions as hit, i (hit.id)}
					<li role="option" aria-selected={i === highlighted}>
						<button
							type="button"
							class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent {i ===
							highlighted
								? 'bg-accent'
								: ''}"
							onmousedown={(e) => e.preventDefault()}
							onclick={() => selectFamily(hit)}
						>
							<span>
								<span class="font-medium">{hit.name}</span>
								{#if hit.phone}<span class="ml-2 text-sm text-muted-foreground">{hit.phone}</span
									>{/if}
								{#if hit.status !== 'active'}<Badge variant="destructive" class="ml-2"
										>inactif</Badge
									>{/if}
							</span>
							<span class="text-sm text-muted-foreground">{hit.openCount} en prêt</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		<Card.Root>
			<Card.Header>
				<Card.Title>Famille</Card.Title>
			</Card.Header>
			<Card.Content>
				{#if family}
					<div class="space-y-2">
						<div class="flex items-center gap-2">
							<a class="text-lg font-medium underline" href="/families/{family.family.id}"
								>{family.family.name}</a
							>
							{#if family.family.status !== 'active'}<Badge variant="destructive">inactif</Badge
								>{/if}
						</div>
						<div class="text-sm text-muted-foreground">
							{family.openLoans.length} sur {data.policy.maxLoans} en prêt
						</div>
						<ul class="space-y-1 text-sm">
							{#each family.openLoans as l (l.id)}
								<li class="flex justify-between gap-2">
									<span>{l.book.title}</span>
									<span class={isOverdue(l.dueAt) ? 'text-destructive' : 'text-muted-foreground'}
										>{fmtDate(l.dueAt)}</span
									>
								</li>
							{/each}
						</ul>
						<Button variant="ghost" size="sm" onclick={finish}>Famille suivante</Button>
					</div>
				{:else}
					<p class="text-sm text-muted-foreground">Tapez le nom de la famille ci-dessus.</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>À prêter ({basket.length})</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#if basket.length === 0}
					<p class="text-sm text-muted-foreground">Scannez les livres.</p>
				{:else}
					<ul class="space-y-1 text-sm">
						{#each basket as b (b.id)}
							<li class="flex items-center justify-between gap-2">
								<span>{b.title}</span>
								<button
									class="text-muted-foreground hover:text-foreground"
									onclick={() => (basket = basket.filter((x) => x.id !== b.id))}
									title="Retirer">×</button
								>
							</li>
						{/each}
					</ul>
				{/if}
				<Button
					class="w-full"
					size="lg"
					disabled={!family || basket.length === 0 || busy}
					onclick={checkout}
				>
					Prêter {basket.length ? `${basket.length} livre(s)` : ''}{family
						? ` à ${family.family.name}`
						: ''}
				</Button>
				<p class="text-xs text-muted-foreground">À rendre sous {data.policy.loanDays} jours.</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>À rendre ({returns.length})</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#if returns.length === 0}
					<p class="text-sm text-muted-foreground">Scannez les livres rapportés.</p>
				{:else}
					<ul class="space-y-1 text-sm">
						{#each returns as r (r.loan.id)}
							<li class="flex items-center justify-between gap-2">
								<span>
									{r.book.title}
									<span class="text-muted-foreground">· {r.loan.family.name}</span>
									{#if isOverdue(r.loan.dueAt)}<span class="text-destructive">
											· en retard</span
										>{/if}
								</span>
								<button
									class="text-muted-foreground hover:text-foreground"
									onclick={() => (returns = returns.filter((x) => x.loan.id !== r.loan.id))}
									title="Retirer">×</button
								>
							</li>
						{/each}
					</ul>
				{/if}
				<Button
					class="desk-accent w-full"
					size="lg"
					variant="secondary"
					disabled={returns.length === 0 || busy}
					onclick={validateReturns}
				>
					Valider {returns.length ? `${returns.length} retour(s)` : 'les retours'}
				</Button>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Activité</Card.Title>
			</Card.Header>
			<Card.Content>
				<ul class="space-y-1 text-sm">
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
							{#if e.href}<a class="underline" href={e.href}>{e.text}</a>{:else}{e.text}{/if}
						</li>
					{:else}
						<li class="text-muted-foreground">Rien pour l'instant.</li>
					{/each}
				</ul>
			</Card.Content>
		</Card.Root>
	</div>

	<ScannerPanel {scanners} />
</div>
