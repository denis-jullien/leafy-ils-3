<script lang="ts">
	import { enhance } from '$app/forms';
	import { superForm } from 'sveltekit-superforms';
	import { enhanceToasts, formToasts } from '$lib/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { ArrowDown, ArrowUp } from '@lucide/svelte';
	import LocalModelCard from '$lib/components/LocalModelCard.svelte';
	import BatchShelver from '$lib/components/BatchShelver.svelte';
	import { localModel } from '$lib/embed/local-model.svelte';
	import { confidenceLabel, proposeShelfLocally, type LocalProposal } from '$lib/embed/classify';

	let { data, form: actionData } = $props();
	// svelte-ignore state_referenced_locally
	const {
		form,
		errors,
		enhance: createEnhance,
		submitting
	} = superForm(data.form, formToasts({ reset: true }));
	let testing = $state(false);
	let localResult = $state<LocalProposal | null | 'error'>(null);

	// When the server test comes back and the local model is on, ask it too.
	$effect(() => {
		const t = actionData && 'test' in actionData ? actionData.test : null;
		if (!t || 'error' in t || !localModel.enabled) {
			localResult = null;
			return;
		}
		localResult = null;
		proposeShelfLocally({
			title: t.title,
			authors: t.authors,
			description: t.description,
			subjects: t.subjects
		})
			.then((p) => (localResult = p))
			.catch(() => (localResult = 'error'));
	});
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">Rayons</h1>
		<Button href="/books" variant="ghost">← Livres</Button>
	</div>
	<p class="max-w-3xl text-sm text-muted-foreground">
		Un rayon est à la fois l'endroit où le livre est rangé et la rubrique du site public. Les règles
		servent à proposer un rayon quand on récupère la notice d'un ISBN : les <strong
			>mots-clés</strong
		>
		(séparés par des virgules) sont cherchés dans les sujets et genres de la notice, la
		<strong>cote Dewey</strong>
		accepte des préfixes (741.5) ou des plages (800-899). Le premier rayon dont une règle correspond l'emporte
		: l'ordre compte. Signaux disponibles comme mots-clés : <code>public:jeunesse</code>,
		<code>public:ado</code>,
		<code>public:adulte</code>, <code>forme:roman</code>, <code>forme:nouvelles</code>,
		<code>forme:fiction</code>,
		<code>forme:poesie</code>, <code>forme:theatre</code>, <code>forme:documentaire</code>.
	</p>

	{#if actionData && 'error' in actionData && actionData.error}
		<p class="text-sm text-destructive">{actionData.error}</p>
	{/if}

	<div class="space-y-3">
		{#each data.shelves as { shelf, books }, i (shelf.id)}
			<Card.Root>
				<Card.Content class="flex flex-wrap items-start gap-3 pt-4">
					<div class="flex flex-col gap-1">
						<form method="post" action="?/move" use:enhance={enhanceToasts('Ordre modifié')}>
							<input type="hidden" name="id" value={shelf.id} /><input
								type="hidden"
								name="dir"
								value="up"
							/>
							<Button type="submit" size="sm" variant="ghost" disabled={i === 0} title="Monter"
								><ArrowUp class="size-4" /></Button
							>
						</form>
						<form method="post" action="?/move" use:enhance={enhanceToasts('Ordre modifié')}>
							<input type="hidden" name="id" value={shelf.id} /><input
								type="hidden"
								name="dir"
								value="down"
							/>
							<Button
								type="submit"
								size="sm"
								variant="ghost"
								disabled={i === data.shelves.length - 1}
								title="Descendre"><ArrowDown class="size-4" /></Button
							>
						</form>
					</div>
					<form
						method="post"
						action="?/save"
						use:enhance={enhanceToasts('Rayon enregistré')}
						class="grid flex-1 gap-3 md:grid-cols-[14rem_1fr_10rem_auto]"
						data-no-wedge
					>
						<input type="hidden" name="id" value={shelf.id} />
						<div class="space-y-1">
							<Label for="name-{shelf.id}">Nom</Label>
							<Input id="name-{shelf.id}" name="name" value={shelf.name} />
							<p class="text-xs text-muted-foreground">{books} livre{books > 1 ? 's' : ''}</p>
						</div>
						<div class="space-y-1">
							<Label for="kw-{shelf.id}">Mots-clés</Label>
							<Input
								id="kw-{shelf.id}"
								name="keywords"
								value={shelf.keywords ?? ''}
								placeholder="roman, romans, forme:roman"
							/>
						</div>
						<div class="space-y-1">
							<Label for="dw-{shelf.id}">Dewey</Label>
							<Input
								id="dw-{shelf.id}"
								name="dewey"
								value={shelf.dewey ?? ''}
								placeholder="800-899"
							/>
						</div>
						<div class="flex items-end gap-1">
							<Button type="submit" size="sm" variant="secondary">
								{actionData && 'saved' in actionData && actionData.saved === shelf.id
									? 'Enregistré ✓'
									: 'Enregistrer'}
							</Button>
						</div>
						<div class="space-y-1 md:col-span-4">
							<Label for="desc-{shelf.id}">Description (pour le modèle local)</Label>
							<Input
								id="desc-{shelf.id}"
								name="description"
								value={shelf.description ?? ''}
								placeholder="Une phrase : ce qu'on range ici."
							/>
						</div>
					</form>
					<form
						method="post"
						action="?/remove"
						use:enhance={enhanceToasts('Rayon supprimé')}
						class="self-end"
						onsubmit={(e) => {
							if (
								!confirm(
									`Supprimer le rayon « ${shelf.name} » ? Les ${books} livre(s) resteront sans rayon.`
								)
							)
								e.preventDefault();
						}}
					>
						<input type="hidden" name="id" value={shelf.id} />
						<Button type="submit" size="sm" variant="ghost" class="text-destructive"
							>Supprimer</Button
						>
					</form>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<Card.Root>
			<Card.Header><Card.Title>Nouveau rayon</Card.Title></Card.Header>
			<Card.Content>
				<form method="post" action="?/create" use:createEnhance class="space-y-3" data-no-wedge>
					<div class="space-y-1">
						<Label for="new-name">Nom</Label>
						<Input id="new-name" name="name" bind:value={$form.name} placeholder="Ados" />
						{#if $errors.name}<p class="text-sm text-destructive">{$errors.name}</p>{/if}
					</div>
					<div class="space-y-1">
						<Label for="new-kw">Mots-clés</Label>
						<Input
							id="new-kw"
							name="keywords"
							bind:value={$form.keywords}
							placeholder="public:ado, adolescents, young adult"
						/>
					</div>
					<div class="space-y-1">
						<Label for="new-dw">Dewey</Label>
						<Input id="new-dw" name="dewey" bind:value={$form.dewey} placeholder="" />
					</div>
					<div class="space-y-1">
						<Label for="new-desc">Description (pour le modèle local)</Label>
						<Input
							id="new-desc"
							name="description"
							bind:value={$form.description}
							placeholder="Romans pour adolescents et jeunes adultes."
						/>
					</div>
					<Button type="submit" disabled={$submitting}>Ajouter</Button>
				</form>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Tester les règles</Card.Title>
				<Card.Description
					>Un ISBN : on récupère la notice et on montre ce que les règles en font.</Card.Description
				>
			</Card.Header>
			<Card.Content class="space-y-3">
				<form
					method="post"
					action="?/test"
					use:enhance={() => {
						testing = true;
						return async ({ update }) => {
							testing = false;
							await update({ reset: false });
						};
					}}
					class="flex gap-2"
					data-no-wedge
				>
					<Input name="isbn" placeholder="Scannez ou tapez un ISBN" class="font-mono" />
					<Button type="submit" variant="secondary" disabled={testing}
						>{testing ? 'Recherche…' : 'Tester'}</Button
					>
				</form>
				{#if actionData && 'test' in actionData && actionData.test}
					{@const t = actionData.test}
					{#if 'error' in t}
						<p class="text-sm text-destructive">{t.error}</p>
					{:else}
						<div class="space-y-2 text-sm">
							<p><strong>{t.title}</strong></p>
							<p>
								Rayon proposé :
								{#if t.shelf}<strong>{t.shelf}</strong>
									<span class="text-muted-foreground">({t.reason})</span>{:else}<em>aucun</em>{/if}
							</p>
							{#if localModel.enabled}
								<p>
									Modèle local :
									{#if localResult === 'error'}<span class="text-destructive">indisponible</span>
									{:else if localResult}<strong>{localResult.shelfName}</strong>
										<span class="text-muted-foreground">
											({confidenceLabel[localResult.confidence]}, {localResult.score.toFixed(
												2
											)}{localResult.runnerUpName ? `, sinon ${localResult.runnerUpName}` : ''})
										</span>
									{:else}<span class="text-muted-foreground">calcul…</span>{/if}
								</p>
							{/if}
							<p class="text-muted-foreground">
								Sujets et signaux : {t.subjects.length ? t.subjects.join(' · ') : '—'}
							</p>
							<p class="text-muted-foreground">
								Dewey : {t.dewey.length ? t.dewey.join(', ') : '—'}
							</p>
						</div>
					{/if}
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<LocalModelCard />
		<BatchShelver />
	</div>
</div>
