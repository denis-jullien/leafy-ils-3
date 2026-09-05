<script lang="ts">
	import { enhance } from '$app/forms';
	import { superForm } from 'sveltekit-superforms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';

	let { data, form: actionData } = $props();
	// svelte-ignore state_referenced_locally
	const {
		form,
		errors,
		message,
		enhance: formEnhance,
		submitting
	} = superForm(data.form, { resetForm: true });
</script>

<div class="grid gap-6 lg:grid-cols-[1fr_360px]">
	<Card.Root>
		<Card.Header><Card.Title>Volunteers</Card.Title></Card.Header>
		<Card.Content>
			{#if actionData && 'error' in actionData && actionData.error}
				<p class="mb-2 text-sm text-destructive">{actionData.error}</p>
			{/if}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Name</Table.Head>
						<Table.Head>Email</Table.Head>
						<Table.Head>Role</Table.Head>
						<Table.Head></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.users as u (u.id)}
						<Table.Row>
							<Table.Cell>{u.name}</Table.Cell>
							<Table.Cell class="text-sm">{u.email}</Table.Cell>
							<Table.Cell
								><Badge variant={u.role === 'admin' ? 'default' : 'secondary'}
									>{u.role === 'admin' ? 'admin' : 'volunteer'}</Badge
								></Table.Cell
							>
							<Table.Cell class="flex justify-end gap-1">
								<form method="post" action="?/setRole" use:enhance>
									<input type="hidden" name="userId" value={u.id} />
									<input type="hidden" name="role" value={u.role === 'admin' ? 'user' : 'admin'} />
									<Button type="submit" size="sm" variant="ghost"
										>{u.role === 'admin' ? 'Make volunteer' : 'Make admin'}</Button
									>
								</form>
								<form
									method="post"
									action="?/remove"
									use:enhance
									onsubmit={(e) => {
										if (!confirm(`Remove ${u.name}?`)) e.preventDefault();
									}}
								>
									<input type="hidden" name="userId" value={u.id} />
									<Button type="submit" size="sm" variant="ghost" class="text-destructive"
										>Remove</Button
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
			<Card.Title>Add a volunteer</Card.Title>
			<Card.Description>They sign in with this email and password.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="post" action="?/create" use:formEnhance class="space-y-3" data-no-wedge>
				<div class="space-y-1">
					<Label for="name">Name</Label>
					<Input id="name" name="name" bind:value={$form.name} />
					{#if $errors.name}<p class="text-sm text-destructive">{$errors.name}</p>{/if}
				</div>
				<div class="space-y-1">
					<Label for="email">Email</Label>
					<Input id="email" name="email" type="email" bind:value={$form.email} />
					{#if $errors.email}<p class="text-sm text-destructive">{$errors.email}</p>{/if}
				</div>
				<div class="space-y-1">
					<Label for="password">Password</Label>
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
					<Label for="role">Role</Label>
					<select
						id="role"
						name="role"
						bind:value={$form.role}
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
					>
						<option value="user">Volunteer</option>
						<option value="admin">Administrator</option>
					</select>
				</div>
				{#if $message}<p class="text-sm">{$message}</p>{/if}
				<Button type="submit" disabled={$submitting}>Create account</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
