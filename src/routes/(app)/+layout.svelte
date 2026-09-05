<script lang="ts">
	import './desk.css';
	import AppNav from '$lib/components/AppNav.svelte';

	let { data, children } = $props();
</script>

<div class="desk">
	{#if data.user}
		<AppNav user={data.user} />
	{/if}
	<main class="mx-auto w-full max-w-6xl px-4 py-6">
		{@render children()}
	</main>
</div>
