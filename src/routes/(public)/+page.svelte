<script lang="ts">
	import BookCard from '$lib/components/site/BookCard.svelte';
	import EventCard from '$lib/components/site/EventCard.svelte';
	import { CATEGORIES } from '$lib/config';
	import { CONTACT, HOURS, MEMBERSHIP, SITE } from '$lib/content/site';

	let { data } = $props();

	/** Build a home URL keeping the current query / category unless overridden. */
	function href(over: { q?: string; cat?: string | null }) {
		const q = over.q ?? data.q;
		const cat = over.cat === undefined ? data.category : over.cat;
		const parts = [
			q && `q=${encodeURIComponent(q)}`,
			cat && `cat=${encodeURIComponent(cat)}`
		].filter(Boolean);
		return `/${parts.length ? `?${parts.join('&')}` : ''}#nouveautes`;
	}

	const n = $derived(data.books.length);
	const plural = $derived(n > 1 ? 's' : '');
	const [leadBefore, leadAfter] = $derived(MEMBERSHIP.lead.split(MEMBERSHIP.highlight));
</script>

<svelte:head>
	<title>{SITE.name} — Accueil</title>
	<meta
		name="description"
		content="{SITE.name}, bibliothèque de Saint-Jean-de-Cornies : catalogue en ligne, horaires, événements et inscription."
	/>
</svelte:head>

<!-- ——— Search band ——— -->
<section class="searchband" id="accueil">
	<div class="wrap searchband-inner">
		<div class="sb-intro">
			<h1 class="sb-title">Chercher un livre</h1>
			<p class="sb-lead">Tapez un titre ou un nom d'auteur — même quelques lettres suffisent.</p>
		</div>
		<form class="sb-form" method="get" action="/#nouveautes" data-no-wedge>
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
				{#if data.category}<input type="hidden" name="cat" value={data.category} />{/if}
				<button class="sb-btn" type="submit">Rechercher</button>
			</div>
			{#if data.searching}
				<a class="sb-clear" href={href({ q: '' })}>Effacer la recherche « {data.q} »</a>
			{:else}
				<p class="sb-hint">Pas besoin des accents ni des majuscules.</p>
			{/if}
		</form>
	</div>
</section>

<!-- ——— Books: volunteers' picks, or search results ——— -->
<section class="section section-alt" id="nouveautes">
	<div class="wrap">
		<div class="section-head">
			<div>
				<span class="kicker kicker-1"
					>{data.searching ? 'Dans notre catalogue' : 'La sélection des bénévoles'}</span
				>
				<h2 class="section-title">{data.searching ? 'Résultats' : 'Coups de cœur'}</h2>
			</div>
			<p class="section-note">{n} ouvrage{plural} affiché{plural}</p>
		</div>

		<nav class="filters" aria-label="Catégories">
			<a class="chip" class:is-active={!data.category} href={href({ cat: null })}>Tout</a>
			{#each CATEGORIES as c (c.id)}
				<a class="chip" class:is-active={data.category === c.id} href={href({ cat: c.id })}
					>{c.label}</a
				>
			{/each}
			{#if data.searching}
				<a class="chip chip-clear" href={href({ q: '' })}>« {data.q} » ✕</a>
			{/if}
		</nav>

		{#if n === 0}
			<div class="empty">
				{#if data.searching || data.category}
					<p>Aucun ouvrage ne correspond à votre recherche.</p>
					<a class="btn-ghost" href="/#nouveautes">Réinitialiser</a>
				{:else}
					<p>Le catalogue en ligne arrive bientôt. Passez nous voir !</p>
				{/if}
			</div>
		{:else if data.searching}
			<div class="book-grid">
				{#each data.books as book (book.id)}<BookCard {book} />{/each}
			</div>
		{:else}
			<div class="book-row">
				{#each data.books as book (book.id)}<BookCard {book} />{/each}
			</div>
		{/if}
	</div>
</section>

<!-- ——— Events ——— -->
{#if data.events.length > 0}
	<section class="section" id="evenements">
		<div class="wrap">
			<div class="section-head">
				<div>
					<span class="kicker kicker-2">Le programme</span>
					<h2 class="section-title">Prochains événements</h2>
				</div>
				<a
					class="section-link"
					href="mailto:{CONTACT.email}?subject={encodeURIComponent(
						"Recevoir l'agenda de la bibliothèque"
					)}">Recevoir l'agenda →</a
				>
			</div>
			<div class="event-list">
				{#each data.events as event (event.id)}<EventCard {event} />{/each}
			</div>
		</div>
	</section>
{/if}

<!-- ——— Practical information ——— -->
<section class="section section-alt" id="infos">
	<div class="wrap">
		<div class="section-head">
			<div>
				<span class="kicker kicker-3">Venir nous voir</span>
				<h2 class="section-title">Infos pratiques</h2>
			</div>
		</div>
		<div class="info-grid">
			<div class="card hours-card">
				<h3 class="card-h">Horaires d'ouverture</h3>
				<ul class="hours">
					{#each HOURS as h, i (h.day)}
						<li class:closed={h.closed} class:today={i === data.todayIdx}>
							<span class="h-day"
								>{h.day}{#if i === data.todayIdx}<em>&nbsp;· aujourd'hui</em>{/if}</span
							>
							<span class="h-slot">{h.slots}</span>
						</li>
					{/each}
				</ul>
			</div>

			<div class="info-col">
				<div class="card">
					<h3 class="card-h">Nous trouver</h3>
					<p class="info-line"><strong>{CONTACT.place}</strong></p>
					<p class="info-line">{CONTACT.address}</p>
					{#if CONTACT.mapUrl}
						<a class="map-placeholder" href={CONTACT.mapUrl} target="_blank" rel="noopener"
							><span>{CONTACT.mapLabel}</span></a
						>
					{:else}
						<div class="map-placeholder"><span>{CONTACT.mapLabel}</span></div>
					{/if}
				</div>
				<div class="card">
					<h3 class="card-h">Contact</h3>
					<p class="info-line">
						☎ <a href="tel:{CONTACT.phone.replace(/\s/g, '')}">{CONTACT.phone}</a>
					</p>
					<p class="info-line">✉ <a href="mailto:{CONTACT.email}">{CONTACT.email}</a></p>
				</div>
			</div>

			<div class="card join-card">
				<h3 class="card-h">S'inscrire</h3>
				<p class="join-lead">{leadBefore}<strong>{MEMBERSHIP.highlight}</strong>{leadAfter}</p>
				<ul class="join-list">
					{#each MEMBERSHIP.points as point (point)}<li>{point}</li>{/each}
				</ul>
				<a
					class="join-btn"
					href="mailto:{CONTACT.email}?subject={encodeURIComponent(
						'Inscription à la bibliothèque'
					)}">Nous écrire pour s'inscrire</a
				>
			</div>
		</div>
	</div>
</section>
