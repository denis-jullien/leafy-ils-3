<script lang="ts">
	import JsBarcode from 'jsbarcode';

	/** Renders a Code 128 barcode in the browser. Prints cleanly; nothing to fetch. */
	let { value, height = 48, text }: { value: string; height?: number; text?: string } = $props();
	let svg: SVGSVGElement | undefined = $state();

	$effect(() => {
		if (!svg) return;
		JsBarcode(svg, value, {
			format: 'CODE128',
			height,
			width: 2,
			displayValue: true,
			text: text ?? value,
			fontSize: 14,
			margin: 4
		});
	});
</script>

<svg bind:this={svg} class="max-w-full"></svg>
