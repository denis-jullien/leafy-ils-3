<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import Logo from '$lib/components/site/Logo.svelte';
	import { LIBRARY_NAME } from '$lib/config';
	import {
		BookOpen,
		Users,
		ArrowLeftRight,
		LayoutDashboard,
		Shield,
		LogOut,
		Globe,
		CalendarDays
	} from '@lucide/svelte';

	let { user }: { user: { name: string; role?: string | null } } = $props();

	const links = [
		{ href: '/desk', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
		{ href: '/circulation', label: 'Prêts & retours', icon: ArrowLeftRight },
		{ href: '/books', label: 'Livres', icon: BookOpen },
		{ href: '/families', label: 'Familles', icon: Users },
		{ href: '/events', label: 'Événements', icon: CalendarDays }
	];

	const active = (href: string, exact = false) =>
		exact ? page.url.pathname === href : page.url.pathname.startsWith(href);
</script>

<header class="desk-header">
	<div class="desk-header-inner mx-auto max-w-[1440px] px-4">
		<a href="/desk" class="desk-brand">
			<Logo size={40} />
			<span class="desk-brand-text">
				<span class="desk-brand-name">{LIBRARY_NAME}</span>
				<span class="desk-tag">Espace bénévoles</span>
			</span>
		</a>
		<nav class="desk-nav" aria-label="Menu du bureau">
			{#each links as l (l.href)}
				<a href={l.href} class:is-active={active(l.href, l.exact)}>
					<l.icon class="size-4" />
					{l.label}
				</a>
			{/each}
			{#if user.role === 'admin'}
				<a href="/admin/volunteers" class:is-active={active('/admin')}>
					<Shield class="size-4" />
					Bénévoles
				</a>
			{/if}
		</nav>
		<div class="desk-user">
			<a href="/" title="Voir le site public">
				<Globe class="size-4" />
				<span class="hidden md:inline">Site public</span>
			</a>
			<span class="name">{user.name}</span>
			<form method="post" action="/logout" use:enhance>
				<button type="submit" title="Se déconnecter">
					<LogOut class="size-4" />
				</button>
			</form>
		</div>
	</div>
</header>
