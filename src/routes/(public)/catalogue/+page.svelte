<script lang="ts">
	import BookCard from '$lib/components/site/BookCard.svelte';
	import { SITE } from '$lib/content/site';

	let { data } = $props();

	const n = $derived(data.books.length);
	const plural = $derived(data.total > 1 ? 's' : '');
</script>

<svelte:head>
	<title>{data.q ? `« ${data.q} » — ` : ''}Catalogue — {SITE.name}</title>
	<meta name="description" content="Le catalogue en ligne de la bibliothèque {SITE.name}." />
</svelte:head>

<!-- ——— Search band ——— -->
<section class="searchband" id="catalogue">
	<div class="wrap searchband-inner">
		<div class="sb-intro">
			<a class="sb-back" href="/">← Retour à l'accueil</a>
			<h1 class="sb-title">Catalogue</h1>
			<p class="sb-lead">Tapez un titre ou un nom d'auteur — même quelques lettres suffisent.</p>
		</div>
		<form class="sb-form" method="get" action="/catalogue" data-no-wedge>
			<label class="sb-label" for="q">Titre ou auteur</label>
			<div class="sb-row">
				<input
					id="q"
					name="q"
					type="search"
					value={data.q}
					placeholder="Exemple : jardin, ou Ferrand"
					autocomplete="off"
				/>
				{#if data.rayon}<input type="hidden" name="rayon" value={data.rayon} />{/if}
				<button class="sb-btn" type="submit">Rechercher</button>
			</div>
		</form>
	</div>
</section>

<!-- ——— Results ——— -->
<section class="section section-alt" id="resultats">
	<div class="wrap">
		<div class="section-head">
			<div>
				<span class="kicker kicker-1">Dans notre catalogue</span>
				<h2 class="section-title">
					{#if data.q}Résultats pour «&nbsp;{data.q}&nbsp;»{:else}Tous les livres{/if}
				</h2>
			</div>
			<p class="section-note">
				{data.total} ouvrage{plural}
				{#if data.pages > 1}— page {data.page} sur {data.pages}{/if}
			</p>
		</div>

		{#if n === 0}
			<div class="empty">
				<p>Aucun ouvrage ne correspond à votre recherche.</p>
				<a class="btn-ghost" href="/catalogue">Voir tous les livres</a>
			</div>
		{:else}
			<div class="book-grid">
				{#each data.books as book (book.id)}<BookCard {book} />{/each}
			</div>
			{#if data.pages > 1}
				<nav class="catalogue-pagination" aria-label="Pages du catalogue">
					{#if data.previousHref}<a class="btn-ghost" href={data.previousHref} rel="prev"
							>← Précédente</a
						>{/if}
					<span aria-current="page">Page {data.page} sur {data.pages}</span>
					{#if data.nextHref}<a class="btn-ghost" href={data.nextHref} rel="next">Suivante →</a
						>{/if}
				</nav>
			{/if}
		{/if}
	</div>
</section>

<style>
	.catalogue-pagination {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin-top: 2rem;
	}
</style>
