<script lang="ts">
	import BookCard from '$lib/components/site/BookCard.svelte';
	import EventCard from '$lib/components/site/EventCard.svelte';
	import { CONTACT, HOURS, MEMBERSHIP, SITE, mapLinks } from '$lib/content/site';

	const map = mapLinks();

	let { data } = $props();

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
		<form class="sb-form" method="get" action="/catalogue" data-no-wedge>
			<label class="sb-label" for="q">Titre ou auteur</label>
			<div class="sb-row">
				<input
					id="q"
					name="q"
					type="search"
					placeholder="Exemple : jardin, ou Ferrand"
					autocomplete="off"
				/>
				<button class="sb-btn" type="submit">Rechercher</button>
			</div>
		</form>
	</div>
</section>

<!-- ——— Books: volunteers' picks ——— -->
<section class="section section-alt" id="nouveautes">
	<div class="wrap">
		<div class="section-head">
			<div>
				<span class="kicker kicker-1">La sélection des bénévoles</span>
				<h2 class="section-title">Coups de cœur</h2>
			</div>
			<a class="section-link" href="/catalogue">Tout le catalogue →</a>
		</div>

		{#if data.books.length === 0}
			<div class="empty">
				<p>Les coups de cœur des bénévoles arrivent bientôt.</p>
				<a class="btn-ghost" href="/catalogue">Parcourir le catalogue</a>
			</div>
		{:else}
			<div class="book-row">
				{#each data.books as book (book.id)}<BookCard {book} />{/each}
			</div>
		{/if}
	</div>
</section>

<!-- ——— Events ——— -->
{#if data.events.length > 0 || data.pastEvents.length > 0}
	<section class="section" id="evenements">
		<div class="wrap">
			<div class="section-head">
				<div>
					<span class="kicker kicker-2">Le programme</span>
					<h2 class="section-title">Événements</h2>
				</div>
				<a
					class="section-link"
					href="mailto:{CONTACT.email}?subject={encodeURIComponent(
						"Recevoir l'agenda de la bibliothèque"
					)}">Recevoir l'agenda →</a
				>
			</div>
			{#if data.events.length > 0}
				<div class="event-list">
					{#each data.events as event (event.id)}<EventCard {event} />{/each}
				</div>
			{:else}
				<p class="section-note">Rien de programmé pour le moment. Revenez bientôt !</p>
			{/if}
			{#if data.pastEvents.length > 0}
				<h3 class="subsection-title">Ce qui s'est passé</h3>
				<div class="event-list">
					{#each data.pastEvents as event (event.id)}<EventCard {event} past />{/each}
				</div>
			{/if}
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
					<div class="map">
						<iframe
							title="Plan d'accès — {CONTACT.place}"
							src={map.embed}
							loading="lazy"
							referrerpolicy="no-referrer-when-downgrade"
						></iframe>
					</div>
					<p class="map-caption">
						📍 Le repère indique l'entrée de la bibliothèque.{#if CONTACT.access}
							{CONTACT.access}{/if}
					</p>
					<p class="map-links">
						<a href={map.page} target="_blank" rel="noopener">Voir en plus grand ↗</a>
						<a href={map.route} target="_blank" rel="noopener">Itinéraire jusqu'à l'entrée ↗</a>
					</p>
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
