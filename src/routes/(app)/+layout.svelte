<script lang="ts">
	import './desk.css';
	import AppNav from '$lib/components/AppNav.svelte';
	import { Toaster } from 'svelte-sonner';

	let { data, children } = $props();
</script>

<div class="desk">
	{#if data.user}
		<AppNav user={data.user} />
	{/if}
	<main class="mx-auto w-full max-w-[1440px] px-4 py-6">
		{@render children()}
	</main>
	<Toaster position="bottom-right" richColors closeButton duration={3500} />
</div>
