<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { LIBRARY_NAME } from '$lib/config';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, message, enhance, submitting } = superForm(data.form);
</script>

<div class="min-h-screen bg-background px-4 text-foreground">
	<div class="mx-auto max-w-sm pt-16">
		<Card.Root>
			<Card.Header>
				<Card.Title>Bienvenue sur {LIBRARY_NAME}</Card.Title>
				<Card.Description>
					Aucun compte n'existe encore. Créez le compte administrateur. Les autres bénévoles seront
					ajoutés ensuite depuis la page Bénévoles.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="post" use:enhance class="space-y-4" data-no-wedge>
					<div class="space-y-1">
						<Label for="name">Votre nom</Label>
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
							type="password"
							autocomplete="new-password"
							bind:value={$form.password}
						/>
						{#if $errors.password}<p class="text-sm text-destructive">{$errors.password}</p>{/if}
					</div>
					{#if $message}<p class="text-sm text-destructive">{$message}</p>{/if}
					<Button type="submit" class="w-full" disabled={$submitting}>Créer l'administrateur</Button
					>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
</div>
