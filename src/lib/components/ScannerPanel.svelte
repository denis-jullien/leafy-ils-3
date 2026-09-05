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
		Readers:
		<Badge variant={scanners.keyboard ? 'default' : 'outline'}>keyboard wedge</Badge>
		<Badge variant={scanners.serialConnected ? 'default' : 'outline'}>serial</Badge>
		<Badge variant={scanners.bridgeConnected ? 'default' : 'outline'}>bridge</Badge>
	</summary>
	<div class="mt-3 space-y-3" data-no-wedge>
		<p class="text-muted-foreground">
			USB barcode guns and keyboard-mode RFID readers work with no setup: they type the code and
			press Enter.
		</p>

		<div class="space-y-1">
			<div class="font-medium">Serial RFID reader (RS232 / USB-serial)</div>
			{#if scanners.serialSupported}
				<div class="flex flex-wrap items-center gap-2">
					<Input type="number" bind:value={scanners.serialBaud} class="w-28" />
					{#if scanners.serialConnected}
						<Button size="sm" variant="secondary" onclick={() => scanners.disconnectSerial()}
							>Disconnect</Button
						>
					{:else}
						<Button size="sm" onclick={() => scanners.connectSerial()}>Connect…</Button>
					{/if}
				</div>
			{:else}
				<p class="text-muted-foreground">Needs Chrome or Edge (Web Serial API).</p>
			{/if}
		</div>

		<div class="space-y-1">
			<div class="font-medium">Local reader bridge (TCP/IP readers)</div>
			<div class="flex flex-wrap items-center gap-2">
				<Input bind:value={bridgeInput} class="w-64 font-mono" />
				{#if scanners.bridgeUrl}
					<Button size="sm" variant="secondary" onclick={() => scanners.disableBridge()}
						>Disable</Button
					>
				{:else}
					<Button size="sm" onclick={() => scanners.enableBridge(bridgeInput)}>Enable</Button>
				{/if}
			</div>
			<p class="text-muted-foreground">
				Run <code>tools/reader-bridge</code> on the PC that is wired to the reader.
			</p>
		</div>

		{#if scanners.error}<p class="text-destructive">{scanners.error}</p>{/if}
	</div>
</details>
