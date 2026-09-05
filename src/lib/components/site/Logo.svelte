<script lang="ts">
	import { SITE } from '$lib/content/site';

	let { size = 40 }: { size?: number } = $props();
	let broken = $state(false);
	let img: HTMLImageElement | undefined = $state();

	// The image may have failed before hydration, in which case onerror never fires.
	$effect(() => {
		if (img?.complete && img.naturalWidth === 0) broken = true;
	});
</script>

{#if broken}
	<span
		class="logo-fallback"
		style:width="{size}px"
		style:height="{size}px"
		style:font-size="{size * 0.38}px"
		aria-hidden="true">LA</span
	>
{:else}
	<img
		bind:this={img}
		class="logo-img"
		src={SITE.logo}
		width={size}
		height={size}
		alt={SITE.name}
		style:width="{size}px"
		style:height="{size}px"
		onerror={() => (broken = true)}
	/>
{/if}
