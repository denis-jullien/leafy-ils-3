<script lang="ts">
	import Barcode from '$lib/components/Barcode.svelte';
	import { LIBRARY_NAME } from '$lib/config';

	let { data } = $props();
</script>

<!-- Credit-card sized (85.6 × 54 mm). Print at 100 %, no scaling. -->
<div class="card">
	<div class="text-sm font-semibold">{LIBRARY_NAME}</div>
	<div class="text-base">{data.family.name}</div>
	<Barcode value={data.family.barcode} height={40} />
</div>
<p class="no-print mt-4 text-sm text-muted-foreground">
	<button class="underline" onclick={() => window.print()}>Imprimer</button>
	à l'échelle 100 %. La carte a le format d'une carte bancaire.
</p>

<style>
	.card {
		width: 85.6mm;
		height: 54mm;
		padding: 4mm;
		border: 1px dashed #999;
		border-radius: 3mm;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}
	@media print {
		:global(header),
		.no-print {
			display: none !important;
		}
		.card {
			border-color: transparent;
		}
	}
</style>
