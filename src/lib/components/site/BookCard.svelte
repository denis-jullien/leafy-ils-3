<script lang="ts">
	import type { PublicBook } from '$lib/server/catalogue';

	/** `inPicks`: the card sits in the "Coups de cœur" rail, where the flag would say the obvious. */
	let { book, inPicks = false }: { book: PublicBook; inPicks?: boolean } = $props();

	// Typographic cover colours cycle through the palette; the yellow needs dark text.
	const swatch = $derived((book.id % 6) + 1);
	const fg = $derived(swatch === 3 ? '#2a2118' : '#fff');
	const author = $derived(
		book.authors
			?.split(';')
			.map((s) => s.trim())
			.filter(Boolean)
			.join(', ') ?? ''
	);
	const flag = $derived(book.featured && !inPicks ? 'Coup de cœur' : book.isNew ? 'Nouveau' : null);
</script>

<article class="book" class:is-out={!book.available}>
	<a class="book-cover-wrap" href="/livre/{book.id}" aria-label={book.title}>
		{#if book.coverUrl}
			<div class="cover cover-img">
				<img src={book.coverUrl} alt="" loading="lazy" />
			</div>
		{:else}
			<div class="cover cover-min" style:background="var(--c-{swatch})" style:color={fg}>
				<span class="cover-rule"></span>
				<span class="cover-title">{book.title}</span>
				<span class="cover-author">{author}</span>
			</div>
		{/if}
		{#if flag}<span class="book-flag">{flag}</span>{/if}
	</a>
	<div class="book-body">
		<h3 class="book-title"><a href="/livre/{book.id}">{book.title}</a></h3>
		<p class="book-author">{author}</p>
		<div class="book-foot">
			<span class="stock" class:out={!book.available}>
				<span class="stock-dot"></span>
				{book.available ? 'Disponible' : 'Emprunté'}
			</span>
		</div>
	</div>
</article>
