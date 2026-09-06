<script lang="ts">
	/**
	 * An editable cell that saves on its own: PATCH { [field]: value } to `endpoint`.
	 * Text saves on Enter or blur, selects and checkboxes on change. Escape reverts.
	 */
	import { invalidateAll } from '$app/navigation';
	import { Check, X } from '@lucide/svelte';

	type Kind = 'text' | 'select' | 'checkbox';
	let {
		endpoint,
		field,
		value,
		kind = 'text',
		options = [],
		placeholder = '',
		label = field
	}: {
		endpoint: string;
		field: string;
		value: string | boolean | null;
		kind?: Kind;
		options?: { value: string; label: string }[];
		placeholder?: string;
		label?: string;
	} = $props();

	let current = $state<string | boolean | null>(null);
	let draft = $state('');
	// Follow the prop: rows are keyed, but a sort or a page change can reuse an instance.
	$effect(() => {
		current = value;
		draft = typeof value === 'string' ? value : '';
	});
	let status = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let error = $state('');
	let timer: ReturnType<typeof setTimeout> | null = null;

	async function save(next: string | boolean | null) {
		if (next === current) return;
		status = 'saving';
		error = '';
		try {
			const res = await fetch(endpoint, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ [field]: next })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.error ?? `Erreur ${res.status}`);
			current = next;
			status = 'saved';
			// Tell SvelteKit the data changed: reloads this list and drops any page preloaded on hover.
			await invalidateAll();
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => (status = 'idle'), 1500);
		} catch (err) {
			status = 'error';
			error = (err as Error).message;
			draft = typeof current === 'string' ? current : '';
		}
	}

	const commitText = () => save(draft.trim() === '' ? null : draft.trim());
</script>

<span class="quick" data-no-wedge>
	{#if kind === 'text'}
		<input
			class="quick-input"
			bind:value={draft}
			{placeholder}
			aria-label={label}
			onblur={commitText}
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					(e.currentTarget as HTMLInputElement).blur();
				} else if (e.key === 'Escape') {
					draft = typeof current === 'string' ? current : '';
					(e.currentTarget as HTMLInputElement).blur();
				}
			}}
		/>
	{:else if kind === 'select'}
		<select
			class="quick-input"
			aria-label={label}
			value={current ?? ''}
			onchange={(e) => save((e.currentTarget as HTMLSelectElement).value || null)}
		>
			{#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
		</select>
	{:else}
		<input
			type="checkbox"
			class="size-4"
			aria-label={label}
			checked={current === true}
			onchange={(e) => save((e.currentTarget as HTMLInputElement).checked)}
		/>
	{/if}
	<span class="quick-status" aria-live="polite">
		{#if status === 'saving'}<span class="quick-dot"></span>
		{:else if status === 'saved'}<Check class="size-3.5 text-green-700" />
		{:else if status === 'error'}<span title={error}><X class="size-3.5 text-destructive" /></span
			>{/if}
	</span>
</span>
