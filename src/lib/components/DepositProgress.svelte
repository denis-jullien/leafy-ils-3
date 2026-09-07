<script lang="ts">
	/** Where a deposit stands between its arrival and its return date. */
	import { daysUntil } from '$lib/format';

	let { deposit }: { deposit: { receivedOn: string; returnOn: string } } = $props();

	const left = $derived(daysUntil(deposit.returnOn));
	const total = $derived(Math.max(1, daysUntil(deposit.returnOn) - daysUntil(deposit.receivedOn)));
	const pct = $derived(Math.min(100, Math.max(0, ((total - left) / total) * 100)));
	const tone = $derived(left < 0 ? 'late' : left <= 30 ? 'soon' : '');
	const text = $derived(
		left > 1
			? `retour dans ${left} jours`
			: left === 1
				? 'retour demain'
				: left === 0
					? "retour aujourd'hui"
					: `retour dépassé de ${-left} jour${left < -1 ? 's' : ''}`
	);
</script>

<div class="progress {tone}">
	<div class="track"><div class="fill" style:width="{pct}%"></div></div>
	<span class="text">{text}</span>
</div>

<style>
	.progress {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.track {
		flex: 1;
		height: 8px;
		border-radius: 999px;
		background: var(--muted);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--c-secondary), var(--c-primary));
	}
	.soon .fill {
		background: var(--c-accent);
	}
	.late .fill {
		background: var(--destructive);
	}
	.text {
		flex: none;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--muted-foreground);
	}
	.soon .text {
		color: #8a6414;
	}
	.late .text {
		color: var(--destructive);
	}
</style>
