<script lang="ts">
	import { page } from '$app/state';
	import * as Table from '$lib/components/ui/table';
	import { sortHref, type Dir } from '$lib/listing';
	import { ArrowDown, ArrowUp, ArrowUpDown } from '@lucide/svelte';

	let {
		key,
		label,
		sort,
		dir,
		class: className = ''
	}: { key: string; label: string; sort: string; dir: Dir; class?: string } = $props();
	const active = $derived(sort === key);
</script>

<Table.Head class={className}>
	<a
		href={sortHref(page.url, key, { sort, dir })}
		class="sort-head"
		class:is-active={active}
		data-sveltekit-noscroll
	>
		{label}
		{#if active}
			{#if dir === 'asc'}<ArrowUp class="size-3.5" />{:else}<ArrowDown class="size-3.5" />{/if}
		{:else}
			<ArrowUpDown class="size-3.5 opacity-40" />
		{/if}
	</a>
</Table.Head>
