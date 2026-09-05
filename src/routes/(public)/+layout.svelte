<script lang="ts">
	import './public.css';
	import SiteHeader from '$lib/components/site/SiteHeader.svelte';
	import SiteFooter from '$lib/components/site/SiteFooter.svelte';

	let { data, children } = $props();
</script>

<div class="arb">
	<SiteHeader user={data.user} />
	<main>
		{@render children()}
	</main>
	<SiteFooter />
</div>
