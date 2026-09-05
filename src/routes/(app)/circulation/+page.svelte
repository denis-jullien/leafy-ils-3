<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import ScannerPanel from '$lib/components/ScannerPanel.svelte';
	import { Scanners } from '$lib/scan/use-scanners.svelte';
	import type { ScanEvent } from '$lib/scan';
	import type { Resolved } from '$lib/server/circulation';
	import type { Book } from '$lib/server/db/schema';
	import { fmtDate, isOverdue } from '$lib/format';
	import { parseIsbn } from '$lib/isbn';

	let { data } = $props();

	type FamilyState = Extract<Resolved, { kind: 'family' }>;
	type LogEntry = { id: number; tone: 'ok' | 'warn' | 'err' | 'info'; text: string; href?: string };

	let family = $state<FamilyState | null>(null);
	let basket = $state<Book[]>([]);
	let log = $state<LogEntry[]>([]);
	let manual = $state('');
	let busy = $state(false);
	let logSeq = 0;

	const scanners = new Scanners();

	function say(tone: LogEntry['tone'], text: string, href?: string) {
		log = [{ id: ++logSeq, tone, text, href }, ...log].slice(0, 30);
	}

	async function resolve(code: string): Promise<Resolved> {
		const res = await fetch(`/api/scan/${encodeURIComponent(code)}`);
		if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
		return res.json();
	}

	async function refreshFamily() {
		if (!family?.family.barcode) return;
		const r = await resolve(family.family.barcode);
		if (r.kind === 'family') family = r;
	}

	async function returnLoan(loanId: number) {
		const res = await fetch(`/api/loans/${loanId}/return`, { method: 'POST' });
		if (!res.ok) throw new Error((await res.json()).error ?? 'Return failed');
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
				say('info', `${r.family.name}: ${r.openLoans.length} book(s) out`);
				if (r.family.status !== 'active') say('warn', `${r.family.name} is not an active member`);
				return;
			}
			if (r.kind === 'book') {
				const { book, openLoan } = r;
				if (openLoan) {
					await returnLoan(openLoan.id);
					const late = isOverdue(openLoan.dueAt) ? ' (was overdue)' : '';
					say(
						'ok',
						`Returned "${book.title}" from ${openLoan.family.name}${late}`,
						`/books/${book.id}`
					);
					if (family && openLoan.familyId === family.family.id) await refreshFamily();
					return;
				}
				if (book.status !== 'active') {
					say('warn', `"${book.title}" is marked ${book.status}`, `/books/${book.id}`);
					return;
				}
				if (basket.some((b) => b.id === book.id)) {
					say('info', `"${book.title}" is already in the basket`);
					return;
				}
				basket = [...basket, book];
				say('ok', `Added "${book.title}"`, `/books/${book.id}`);
				return;
			}
			const isbn = parseIsbn(code);
			if (isbn)
				say('warn', `Not in the catalogue: ${isbn}. Click to add it.`, `/books/new?isbn=${isbn}`);
			else say('err', `Unknown code: ${code}`);
		} catch (err) {
			say('err', (err as Error).message);
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
			if (!res.ok) throw new Error(body.error ?? 'Checkout failed');
			const due = fmtDate(body.loans[0].dueAt);
			say('ok', `Lent ${basket.length} book(s) to ${family.family.name}, due ${due}`);
			basket = [];
			await refreshFamily();
		} catch (err) {
			say('err', (err as Error).message);
		} finally {
			busy = false;
		}
	}

	function finish() {
		family = null;
		basket = [];
		say('info', 'Ready for the next family');
	}

	function onManualKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			const code = manual;
			manual = '';
			void handleCode(code);
		}
	}

	onMount(() => {
		const cleanup = scanners.attach((ev: ScanEvent) => void handleCode(ev.code));
		if (data.initialCode) void handleCode(data.initialCode);
		return cleanup;
	});
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">Circulation</h1>
		<p class="text-sm text-muted-foreground">
			Scan a family card and books in any order. Scanning a book that is out returns it.
		</p>
	</div>

	<Input
		bind:value={manual}
		onkeydown={onManualKeydown}
		placeholder="Scan here, or type a card number / ISBN and press Enter"
		class="h-12 text-lg"
		autofocus
		data-no-wedge
	/>

	<div class="grid gap-4 lg:grid-cols-3">
		<Card.Root class="lg:col-span-1">
			<Card.Header>
				<Card.Title>Family</Card.Title>
			</Card.Header>
			<Card.Content>
				{#if family}
					<div class="space-y-2">
						<div class="flex items-center gap-2">
							<a class="text-lg font-medium underline" href="/families/{family.family.id}"
								>{family.family.name}</a
							>
							{#if family.family.status !== 'active'}<Badge variant="destructive">inactive</Badge
								>{/if}
						</div>
						<div class="text-sm text-muted-foreground">
							{family.openLoans.length} of {data.policy.maxLoans} out
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
						<Button variant="ghost" size="sm" onclick={finish}>Done with this family</Button>
					</div>
				{:else}
					<p class="text-sm text-muted-foreground">Scan a membership card.</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root class="lg:col-span-1">
			<Card.Header>
				<Card.Title>To lend ({basket.length})</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#if basket.length === 0}
					<p class="text-sm text-muted-foreground">Scan the books.</p>
				{:else}
					<ul class="space-y-1 text-sm">
						{#each basket as b (b.id)}
							<li class="flex items-center justify-between gap-2">
								<span>{b.title}</span>
								<button
									class="text-muted-foreground hover:text-foreground"
									onclick={() => (basket = basket.filter((x) => x.id !== b.id))}
									title="Remove">×</button
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
					Lend {basket.length ? `${basket.length} book(s)` : ''}{family
						? ` to ${family.family.name}`
						: ''}
				</Button>
				<p class="text-xs text-muted-foreground">Due in {data.policy.loanDays} days.</p>
			</Card.Content>
		</Card.Root>

		<Card.Root class="lg:col-span-1">
			<Card.Header>
				<Card.Title>Activity</Card.Title>
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
						<li class="text-muted-foreground">Nothing yet.</li>
					{/each}
				</ul>
			</Card.Content>
		</Card.Root>
	</div>

	<ScannerPanel {scanners} />
</div>
