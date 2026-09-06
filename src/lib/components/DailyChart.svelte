<script lang="ts">
	import type { DayActivity } from '$lib/server/stats';
	import { fmtDay } from '$lib/format';

	const weekdayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
	const dayMonthFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

	let { days }: { days: DayActivity[] } = $props();
	const max = $derived(Math.max(1, ...days.map((d) => Math.max(d.loans, d.returns))));
	const pct = (n: number) => `${Math.round((n / max) * 100)}%`;
	const noon = (iso: string) => new Date(`${iso}T12:00:00`);
	const weekday = (iso: string) => weekdayFmt.format(noon(iso)).replace('.', '');
	const dayMonth = (iso: string) => dayMonthFmt.format(noon(iso)).replace('.', '');
</script>

{#if days.length === 0}
	<p class="text-sm text-muted-foreground">Pas encore de prêt enregistré.</p>
{:else}
	<div class="chart" style:--cols={days.length}>
		{#each days as d (d.day)}
			<div
				class="col"
				title="{fmtDay(d.day)} : {d.loans} prêt{d.loans > 1
					? 's'
					: ''}, {d.returns} retour{d.returns > 1 ? 's' : ''}"
			>
				<div class="bars">
					<div class="bar loans" style:height={pct(d.loans)}>
						{#if d.loans}<span class="n">{d.loans}</span>{/if}
					</div>
					<div class="bar returns" style:height={pct(d.returns)}>
						{#if d.returns}<span class="n">{d.returns}</span>{/if}
					</div>
				</div>
				<div class="day"><span>{weekday(d.day)}</span><span>{dayMonth(d.day)}</span></div>
			</div>
		{/each}
	</div>
	<div class="legend">
		<span><i class="sw loans"></i> Prêts</span>
		<span><i class="sw returns"></i> Retours</span>
	</div>
{/if}

<style>
	.chart {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: 0.5rem;
		height: 190px;
		align-items: end;
	}
	.col {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-width: 0;
	}
	.col:hover .bar {
		filter: brightness(1.06);
	}
	.bars {
		flex: 1;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 3px;
		padding-top: 1.2rem;
	}
	.bar {
		position: relative;
		width: 45%;
		max-width: 26px;
		min-height: 3px;
		border-radius: 6px 6px 3px 3px;
		transition: height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.bar.loans {
		background: linear-gradient(180deg, var(--c-primary), var(--c-secondary));
		box-shadow: 0 6px 14px -8px var(--c-secondary);
	}
	.bar.returns {
		background: color-mix(in srgb, var(--c-accent) 55%, #fff);
	}
	.n {
		position: absolute;
		top: -1.15rem;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--ink);
	}
	.day {
		margin-top: 0.45rem;
		display: flex;
		flex-direction: column;
		font-size: 0.68rem;
		line-height: 1.25;
		font-weight: 700;
		text-align: center;
		color: var(--muted-foreground);
		white-space: nowrap;
	}
	.day span:first-child {
		text-transform: capitalize;
		color: var(--ink);
	}
	.legend {
		display: flex;
		gap: 1.2rem;
		margin-top: 0.8rem;
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--muted-foreground);
	}
	.sw {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 3px;
		vertical-align: -1px;
		margin-right: 0.3rem;
	}
	.sw.loans {
		background: linear-gradient(180deg, var(--c-primary), var(--c-secondary));
	}
	.sw.returns {
		background: color-mix(in srgb, var(--c-accent) 55%, #fff);
	}
</style>
