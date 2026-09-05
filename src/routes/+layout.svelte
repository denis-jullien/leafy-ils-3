<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { LIBRARY_NAME } from '$lib/config';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{LIBRARY_NAME}</title>
</svelte:head>

{@render children()}
