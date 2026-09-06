<script lang="ts">
	import { enhance } from '$app/forms';
	import { superForm } from 'sveltekit-superforms';
	import { enhanceToasts, formToasts } from '$lib/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { ROLE } from '$lib/labels';

	let { data, form: actionData } = $props();
	// svelte-ignore state_referenced_locally
	const {
		form,
		errors,
		enhance: formEnhance,
		submitting
	} = superForm(data.form, formToasts({ reset: true }));
</script>

<div class="grid gap-6 lg:grid-cols-[1fr_360px]">
	<Card.Root>
		<Card.Header><Card.Title>Bénévoles</Card.Title></Card.Header>
		<Card.Content>
			{#if actionData && 'error' in actionData && actionData.error}
				<p class="mb-2 text-sm text-destructive">{actionData.error}</p>
			{/if}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Nom</Table.Head>
						<Table.Head>Email</Table.Head>
						<Table.Head>Rôle</Table.Head>
						<Table.Head></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.users as u (u.id)}
						<Table.Row>
							<Table.Cell>{u.name}</Table.Cell>
							<Table.Cell class="text-sm">{u.email}</Table.Cell>
							<Table.Cell
								><Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{ROLE[u.role]}</Badge
								></Table.Cell
							>
							<Table.Cell class="flex justify-end gap-1">
								<form method="post" action="?/setRole" use:enhance={enhanceToasts('Rôle modifié')}>
									<input type="hidden" name="userId" value={u.id} />
									<input type="hidden" name="role" value={u.role === 'admin' ? 'user' : 'admin'} />
									<Button type="submit" size="sm" variant="ghost"
										>{u.role === 'admin' ? 'Passer bénévole' : 'Passer administrateur'}</Button
									>
								</form>
								<form
									method="post"
									action="?/remove"
									use:enhance={enhanceToasts('Compte supprimé')}
									onsubmit={(e) => {
										if (!confirm(`Supprimer le compte de ${u.name} ?`)) e.preventDefault();
									}}
								>
									<input type="hidden" name="userId" value={u.id} />
									<Button type="submit" size="sm" variant="ghost" class="text-destructive"
										>Supprimer</Button
									>
								</form>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Ajouter un bénévole</Card.Title>
			<Card.Description>Il se connectera avec cet email et ce mot de passe.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="post" action="?/create" use:formEnhance class="space-y-3" data-no-wedge>
				<div class="space-y-1">
					<Label for="name">Nom</Label>
					<Input id="name" name="name" bind:value={$form.name} />
					{#if $errors.name}<p class="text-sm text-destructive">{$errors.name}</p>{/if}
				</div>
				<div class="space-y-1">
					<Label for="email">Email</Label>
					<Input id="email" name="email" type="email" bind:value={$form.email} />
					{#if $errors.email}<p class="text-sm text-destructive">{$errors.email}</p>{/if}
				</div>
				<div class="space-y-1">
					<Label for="password">Mot de passe</Label>
					<Input
						id="password"
						name="password"
						type="text"
						autocomplete="off"
						bind:value={$form.password}
					/>
					{#if $errors.password}<p class="text-sm text-destructive">{$errors.password}</p>{/if}
				</div>
				<div class="space-y-1">
					<Label for="role">Rôle</Label>
					<select
						id="role"
						name="role"
						bind:value={$form.role}
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
					>
						<option value="user">Bénévole</option>
						<option value="admin">Administrateur</option>
					</select>
				</div>
				<Button type="submit" disabled={$submitting}>Créer le compte</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
