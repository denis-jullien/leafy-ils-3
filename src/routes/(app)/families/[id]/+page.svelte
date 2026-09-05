<script lang="ts">
	import { enhance } from '$app/forms';
	import { superForm } from 'sveltekit-superforms';
	import FamilyForm from '$lib/components/FamilyForm.svelte';
	import Barcode from '$lib/components/Barcode.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { fmtDate, isOverdue } from '$lib/format';

	let { data, form: actionData } = $props();
	// svelte-ignore state_referenced_locally
	const sf = superForm(data.form);
	// svelte-ignore state_referenced_locally
	const mf = superForm(data.memberForm, { resetForm: true });
	const { form: memberForm, errors: memberErrors, enhance: memberEnhance } = mf;
</script>

<div class="grid gap-6 lg:grid-cols-[1fr_360px]">
	<div class="space-y-6">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h1 class="text-2xl font-semibold">{data.family.name}</h1>
			<Button href="/circulation?family={data.family.barcode}" variant="secondary"
				>Lend to this family</Button
			>
		</div>

		<Card.Root>
			<Card.Header><Card.Title>Books out ({data.loans.length})</Card.Title></Card.Header>
			<Card.Content>
				{#if actionData && 'error' in actionData && actionData.error}
					<p class="mb-2 text-sm text-destructive">{actionData.error}</p>
				{/if}
				{#if data.loans.length === 0}
					<p class="text-sm text-muted-foreground">Nothing on loan.</p>
				{:else}
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Book</Table.Head>
								<Table.Head>Due</Table.Head>
								<Table.Head></Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each data.loans as l (l.id)}
								<Table.Row>
									<Table.Cell
										><a class="underline" href="/books/{l.book.id}">{l.book.title}</a></Table.Cell
									>
									<Table.Cell class={isOverdue(l.dueAt) ? 'text-destructive' : ''}
										>{fmtDate(l.dueAt)}</Table.Cell
									>
									<Table.Cell class="flex justify-end gap-1">
										<form method="post" action="?/renew" use:enhance>
											<input type="hidden" name="loanId" value={l.id} />
											<Button type="submit" size="sm" variant="ghost">Renew</Button>
										</form>
										<form method="post" action="?/returnBook" use:enhance>
											<input type="hidden" name="bookId" value={l.book.id} />
											<Button type="submit" size="sm" variant="secondary">Return</Button>
										</form>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header><Card.Title>Details</Card.Title></Card.Header>
			<Card.Content><FamilyForm {sf} action="?/save" /></Card.Content>
		</Card.Root>
	</div>

	<div class="space-y-6">
		<Card.Root>
			<Card.Header><Card.Title>Membership card</Card.Title></Card.Header>
			<Card.Content class="space-y-2">
				{#if data.family.barcode}<Barcode value={data.family.barcode} />{/if}
				<Button href="/families/{data.family.id}/card" variant="outline" size="sm" target="_blank"
					>Print card</Button
				>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header><Card.Title>Members</Card.Title></Card.Header>
			<Card.Content class="space-y-3">
				<ul class="space-y-1 text-sm">
					{#each data.members as m (m.id)}
						<li class="flex items-center justify-between">
							<span>{m.name}{m.birthYear ? ` (${m.birthYear})` : ''}</span>
							<form method="post" action="?/removeMember" use:enhance>
								<input type="hidden" name="memberId" value={m.id} />
								<Button type="submit" size="sm" variant="ghost">×</Button>
							</form>
						</li>
					{:else}
						<li class="text-muted-foreground">No members listed.</li>
					{/each}
				</ul>
				<form method="post" action="?/addMember" use:memberEnhance class="flex gap-2" data-no-wedge>
					<Input name="name" bind:value={$memberForm.name} placeholder="Name" />
					<Input
						name="birthYear"
						type="number"
						bind:value={$memberForm.birthYear}
						placeholder="Born"
						class="w-24"
					/>
					<Button type="submit" size="sm">Add</Button>
				</form>
				{#if $memberErrors.name}<p class="text-sm text-destructive">{$memberErrors.name}</p>{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
