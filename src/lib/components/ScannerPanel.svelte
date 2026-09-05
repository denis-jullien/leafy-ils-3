<script lang="ts">
	import type { Scanners } from '$lib/scan/use-scanners.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { DEFAULT_BRIDGE_URL } from '$lib/scan';

	let { scanners }: { scanners: Scanners } = $props();
	let bridgeInput = $derived(scanners.bridgeUrl || DEFAULT_BRIDGE_URL);
</script>

<details class="rounded-md border bg-card p-3 text-sm">
	<summary class="cursor-pointer select-none">
		Lecteurs :
		<Badge variant={scanners.keyboard ? 'default' : 'outline'}>clavier (USB)</Badge>
		<Badge variant={scanners.serialConnected ? 'default' : 'outline'}>série</Badge>
		<Badge variant={scanners.bridgeConnected ? 'default' : 'outline'}>passerelle</Badge>
	</summary>
	<div class="mt-3 space-y-3" data-no-wedge>
		<p class="text-muted-foreground">
			Les douchettes USB et les lecteurs RFID en mode clavier fonctionnent sans réglage : ils tapent
			le code puis Entrée.
		</p>

		<div class="space-y-1">
			<div class="font-medium">Lecteur RFID série (RS232 / USB-série)</div>
			{#if scanners.serialSupported}
				<div class="flex flex-wrap items-center gap-2">
					<Input type="number" bind:value={scanners.serialBaud} class="w-28" />
					{#if scanners.serialConnected}
						<Button size="sm" variant="secondary" onclick={() => scanners.disconnectSerial()}
							>Déconnecter</Button
						>
					{:else}
						<Button size="sm" onclick={() => scanners.connectSerial()}>Connecter…</Button>
					{/if}
				</div>
			{:else}
				<p class="text-muted-foreground">Nécessite Chrome ou Edge (Web Serial API).</p>
			{/if}
		</div>

		<div class="space-y-1">
			<div class="font-medium">Passerelle locale (lecteurs TCP/IP)</div>
			<div class="flex flex-wrap items-center gap-2">
				<Input bind:value={bridgeInput} class="w-64 font-mono" />
				{#if scanners.bridgeUrl}
					<Button size="sm" variant="secondary" onclick={() => scanners.disableBridge()}
						>Désactiver</Button
					>
				{:else}
					<Button size="sm" onclick={() => scanners.enableBridge(bridgeInput)}>Activer</Button>
				{/if}
			</div>
			<p class="text-muted-foreground">
				Lancez <code>tools/reader-bridge</code> sur le PC relié au lecteur.
			</p>
		</div>

		{#if scanners.error}<p class="text-destructive">{scanners.error}</p>{/if}
	</div>
</details>
