<script lang="ts">
	import { page } from '$app/state';

	const title = $derived(
		page.status === 404
			? 'Page introuvable'
			: page.status === 403
				? 'Accès refusé'
				: 'Une erreur est survenue'
	);
	const detail = $derived(
		page.error?.message && !/^(Not Found|Internal Error)$/i.test(page.error.message)
			? page.error.message
			: ''
	);
</script>

<svelte:head><title>{title}</title></svelte:head>

<div class="mx-auto max-w-md px-4 py-24 text-center">
	<p class="text-sm font-semibold text-muted-foreground">{page.status}</p>
	<h1 class="mt-2 text-2xl font-semibold">{title}</h1>
	{#if detail}<p class="mt-2 text-muted-foreground">{detail}</p>{/if}
	<p class="mt-6"><a class="underline" href="/">Retour à l'accueil</a></p>
</div>
