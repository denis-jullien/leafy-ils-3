<script lang="ts">
	import BookCard from '$lib/components/site/BookCard.svelte';
	import { CATEGORIES } from '$lib/config';
	import { SITE } from '$lib/content/site';
	import { formatIsbn13 } from '$lib/isbn';

	let { data } = $props();
	const book = $derived(data.book);
	const swatch = $derived((book.id % 6) + 1);
	const fg = $derived(swatch === 3 ? '#2a2118' : '#fff');
	const authors = $derived(
		book.authors
			?.split(';')
			.map((s) => s.trim())
			.filter(Boolean) ?? []
	);
	const category = $derived(CATEGORIES.find((c) => c.id === book.category));
	const backDate = $derived(
		book.dueAt
			? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(
					new Date(book.dueAt)
				)
			: null
	);
	const facts = $derived(
		[
			book.publisher && ['Éditeur', book.publisher],
			book.publishedYear && ['Année', String(book.publishedYear)],
			book.pageCount && ['Pages', String(book.pageCount)],
			book.language && ['Langue', book.language],
			book.isbn13 && ['ISBN', formatIsbn13(book.isbn13)],
			book.shelf && ['Rayon', book.shelf]
		].filter(Boolean) as [string, string][]
	);
</script>

<svelte:head>
	<title>{book.title} — {SITE.name}</title>
	<meta
		name="description"
		content="{book.title}{authors.length ? `, ${authors.join(', ')}` : ''} — {book.available
			? 'disponible'
			: 'emprunté'} à la bibliothèque {SITE.name}."
	/>
</svelte:head>

<section class="section" id="livre">
	<div class="wrap">
		<a class="back-link" href="/#nouveautes">← Retour au catalogue</a>

		<div class="detail">
			<div class="detail-cover book" class:is-out={!book.available}>
				<div class="book-cover-wrap">
					{#if book.coverUrl}
						<div class="cover cover-img"><img src={book.coverUrl} alt="" /></div>
					{:else}
						<div class="cover cover-min" style:background="var(--c-{swatch})" style:color={fg}>
							<span class="cover-rule"></span>
							<span class="cover-title">{book.title}</span>
							<span class="cover-author">{authors.join(', ')}</span>
						</div>
					{/if}
					{#if book.featured}<span class="book-flag">Coup de cœur</span>{:else if book.isNew}<span
							class="book-flag">Nouveau</span
						>{/if}
				</div>
			</div>

			<div class="detail-main">
				{#if category}<span class="kicker kicker-1">{category.label}</span>{/if}
				<h1 class="section-title">{book.title}</h1>
				{#if authors.length}
					<p class="detail-authors">
						{#each authors as a, i (a)}{#if i > 0},
							{/if}<a href="/?q={encodeURIComponent(a)}#nouveautes">{a}</a>{/each}
					</p>
				{/if}

				<p class="detail-stock">
					<span class="stock" class:out={!book.available}>
						<span class="stock-dot"></span>
						{#if book.available}
							Disponible à la bibliothèque
						{:else if backDate}
							Emprunté · retour prévu le {backDate}
						{:else}
							Emprunté
						{/if}
					</span>
				</p>

				{#if book.description}
					<div class="detail-desc">
						{#each book.description.split(/\n{2,}/) as para (para)}<p>{para}</p>{/each}
					</div>
				{/if}

				{#if facts.length}
					<dl class="facts">
						{#each facts as [label, value] (label)}
							<div>
								<dt>{label}</dt>
								<dd>{value}</dd>
							</div>
						{/each}
					</dl>
				{/if}

				<p class="detail-hint">
					{book.available
						? "Passez nous voir aux heures d'ouverture : premier arrivé, premier servi."
						: 'Repassez après cette date, ou demandez aux bénévoles de vous prévenir.'}
					<a href="/#infos">Horaires &amp; accès →</a>
				</p>
			</div>
		</div>
	</div>
</section>

{#if data.related.length}
	<section class="section section-alt">
		<div class="wrap">
			<div class="section-head">
				<div>
					<span class="kicker kicker-2">Du même auteur</span>
					<h2 class="section-title">{data.firstAuthor}</h2>
				</div>
			</div>
			<div class="book-row">
				{#each data.related as b (b.id)}<BookCard book={b} />{/each}
			</div>
		</div>
	</section>
{/if}
