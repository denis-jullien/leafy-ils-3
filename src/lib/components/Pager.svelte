<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { PAGE_SIZE, pageCount, withParams } from '$lib/listing';

	let {
		current,
		total,
		size = PAGE_SIZE
	}: { current: number; total: number; size?: number } = $props();
	const pages = $derived(pageCount(total, size));
	const from = $derived(total === 0 ? 0 : (current - 1) * size + 1);
	const to = $derived(Math.min(total, current * size));
</script>

{#if total > size}
	<div class="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
		<span>{from}–{to} sur {total}</span>
		<div class="flex items-center gap-1">
			<Button
				href={withParams(page.url, { page: current - 1 })}
				variant="outline"
				size="sm"
				disabled={current <= 1}
				data-sveltekit-noscroll>← Précédent</Button
			>
			<span class="px-2">page {current} / {pages}</span>
			<Button
				href={withParams(page.url, { page: current + 1 })}
				variant="outline"
				size="sm"
				disabled={current >= pages}
				data-sveltekit-noscroll>Suivant →</Button
			>
		</div>
	</div>
{:else if total > 0}
	<p class="text-sm text-muted-foreground">{total} résultat{total > 1 ? 's' : ''}</p>
{/if}
