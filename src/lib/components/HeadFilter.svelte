<script lang="ts">
	/**
	 * A filter control living in the table header, bound to a URL param.
	 * Text applies as you type (debounced) or on Enter; selects apply on change.
	 * Must sit inside a GET form that wraps the table.
	 */
	let {
		name,
		value = '',
		kind = 'text',
		options = [],
		placeholder = 'Filtrer…',
		label = name
	}: {
		name: string;
		value?: string;
		kind?: 'text' | 'select';
		options?: { value: string; label: string }[];
		placeholder?: string;
		label?: string;
	} = $props();

	let timer: ReturnType<typeof setTimeout> | null = null;
	const submit = (el: HTMLElement) => el.closest('form')?.requestSubmit();
	function onInput(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => submit(el), 450);
	}
</script>

{#if kind === 'select'}
	<select
		class="head-filter"
		{name}
		{value}
		aria-label={label}
		onchange={(e) => submit(e.currentTarget)}
	>
		{#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
	</select>
{:else}
	<input
		class="head-filter"
		type="search"
		{name}
		{value}
		{placeholder}
		aria-label={label}
		autocomplete="off"
		oninput={onInput}
		onkeydown={(e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				if (timer) clearTimeout(timer);
				submit(e.currentTarget);
			}
		}}
	/>
{/if}
