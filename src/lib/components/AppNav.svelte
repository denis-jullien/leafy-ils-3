<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { LIBRARY_NAME } from '$lib/config';
	import { BookOpen, Users, ArrowLeftRight, LayoutDashboard, Shield, LogOut } from '@lucide/svelte';

	let { user }: { user: { name: string; role?: string | null } } = $props();

	const links = [
		{ href: '/desk', label: 'Dashboard', icon: LayoutDashboard, exact: true },
		{ href: '/circulation', label: 'Circulation', icon: ArrowLeftRight },
		{ href: '/books', label: 'Books', icon: BookOpen },
		{ href: '/families', label: 'Families', icon: Users }
	];

	const active = (href: string, exact = false) =>
		exact ? page.url.pathname === href : page.url.pathname.startsWith(href);
</script>

<header class="border-b bg-card">
	<div class="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
		<a href="/desk" class="mr-4 text-lg font-semibold">{LIBRARY_NAME}</a>
		<nav class="flex flex-1 flex-wrap gap-1">
			{#each links as l (l.href)}
				<Button href={l.href} variant={active(l.href, l.exact) ? 'secondary' : 'ghost'} size="sm">
					<l.icon class="size-4" />
					{l.label}
				</Button>
			{/each}
			{#if user.role === 'admin'}
				<Button
					href="/admin/volunteers"
					variant={active('/admin') ? 'secondary' : 'ghost'}
					size="sm"
				>
					<Shield class="size-4" />
					Admin
				</Button>
			{/if}
		</nav>
		<span class="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
		<form method="post" action="/logout" use:enhance>
			<Button type="submit" variant="ghost" size="sm" title="Sign out">
				<LogOut class="size-4" />
			</Button>
		</form>
	</div>
</header>
