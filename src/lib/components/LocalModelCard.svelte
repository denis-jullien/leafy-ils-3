<script lang="ts">
	/* Switch for the optional in-browser embedding model, with its download state. */
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { localModel, LOCAL_MODEL_ID } from '$lib/embed/local-model.svelte';
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Modèle local (navigateur)</Card.Title>
		<Card.Description>
			Un petit modèle de langue multilingue qui tourne dans ce navigateur, sans envoyer les données
			ailleurs. Il compare chaque livre aux descriptions des rayons et aux livres déjà rangés, et
			propose un rayon quand les règles ne trouvent rien. Téléchargé une fois (environ 120 Mo), puis
			gardé en cache par le navigateur. Prévu pour un ordinateur : sur une tablette, laissez-le
			désactivé.
		</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-3">
		<div class="flex flex-wrap items-center gap-2">
			{#if localModel.enabled}
				<Button size="sm" variant="secondary" onclick={() => localModel.setEnabled(false)}
					>Désactiver</Button
				>
			{:else}
				<Button size="sm" onclick={() => localModel.setEnabled(true)}
					>Activer dans ce navigateur</Button
				>
			{/if}
			{#if localModel.status === 'loading'}
				<Badge variant="secondary">chargement {localModel.progress}%</Badge>
			{:else if localModel.status === 'ready'}
				<Badge>prêt · {localModel.device === 'webgpu' ? 'carte graphique' : 'processeur'}</Badge>
			{:else if localModel.status === 'error'}
				<Badge variant="destructive">erreur</Badge>
			{/if}
			<span class="text-xs text-muted-foreground">{LOCAL_MODEL_ID}</span>
		</div>
		{#if localModel.status === 'error'}<p class="text-sm text-destructive">
				{localModel.error}
			</p>{/if}
		{#if localModel.enabled && !localModel.webgpuAvailable}
			<p class="text-xs text-muted-foreground">
				Pas de WebGPU dans ce navigateur : le modèle tourne sur le processeur, un peu plus
				lentement.
			</p>
		{/if}
	</Card.Content>
</Card.Root>
