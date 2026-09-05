<script lang="ts">
	import AppNav from '$lib/components/AppNav.svelte';

	let { data, children } = $props();
</script>

<div class="min-h-screen bg-background text-foreground">
	{#if data.user}
		<AppNav user={data.user} />
	{/if}
	<main class="mx-auto w-full max-w-6xl px-4 py-6">
		{@render children()}
	</main>
</div>
