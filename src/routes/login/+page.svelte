<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import DeskBrand from '$lib/components/DeskBrand.svelte';
	import '../(app)/desk.css';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, message, enhance, submitting } = superForm(data.form);
</script>

<div class="desk px-4">
	<div class="mx-auto max-w-sm pt-16">
		<DeskBrand />
		<Card.Root>
			<Card.Header>
				<Card.Title>Connexion</Card.Title>
				<Card.Description>Entrez votre email et votre mot de passe.</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="post" use:enhance class="space-y-4" data-no-wedge>
					<div class="space-y-1">
						<Label for="email">Email</Label>
						<Input
							id="email"
							name="email"
							type="email"
							autocomplete="username"
							bind:value={$form.email}
						/>
						{#if $errors.email}<p class="text-sm text-destructive">{$errors.email}</p>{/if}
					</div>
					<div class="space-y-1">
						<Label for="password">Mot de passe</Label>
						<Input
							id="password"
							name="password"
							type="password"
							autocomplete="current-password"
							bind:value={$form.password}
						/>
						{#if $errors.password}<p class="text-sm text-destructive">{$errors.password}</p>{/if}
					</div>
					{#if $message}<p class="text-sm text-destructive">{$message}</p>{/if}
					<Button type="submit" class="w-full" disabled={$submitting}>Se connecter</Button>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
</div>
