<script lang="ts">
	import Logo from './Logo.svelte';
	import { SITE } from '$lib/content/site';

	let { user }: { user: { name: string } | null } = $props();
	let open = $state(false);
	const cta = $derived(
		user
			? { href: '/desk', label: 'Mon espace bénévole' }
			: { href: '/login', label: 'Espace bénévoles' }
	);
	const links = [
		{ href: '/#nouveautes', label: 'Coups de cœur' },
		{ href: '/#evenements', label: 'Événements' },
		{ href: '/#infos', label: 'Infos pratiques' }
	];
</script>

<header class="site-header">
	<div class="wrap header-inner">
		<a class="brand" href="/#accueil">
			<Logo size={44} />
			<span class="brand-text">
				<span class="brand-name">{SITE.name}</span>
				<span class="brand-sub">{SITE.tagline}</span>
			</span>
		</a>
		<nav class="main-nav" class:is-open={open} id="main-nav">
			{#each links as l (l.href)}
				<a href={l.href} onclick={() => (open = false)}>{l.label}</a>
			{/each}
			<a class="nav-cta-mobile" href={cta.href}>{cta.label}</a>
		</nav>
		<a class="nav-cta" href={cta.href}>{cta.label}</a>
		<button
			class="burger"
			type="button"
			onclick={() => (open = !open)}
			aria-expanded={open}
			aria-controls="main-nav"
		>
			<span class="burger-bars" aria-hidden="true"><span></span><span></span><span></span></span>
			<span class="burger-label">Menu</span>
		</button>
	</div>
</header>
