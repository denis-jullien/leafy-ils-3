<script lang="ts">
	interface Props {
		event: {
			day: string;
			month: string;
			weekday: string;
			time: string | null;
			title: string;
			tag: string | null;
			description: string | null;
			free: boolean;
		};
	}
	let { event }: Props = $props();
</script>

<article class="event">
	<div class="event-date">
		<span class="ed-day">{event.day}</span>
		<span class="ed-month">{event.month}</span>
	</div>
	<div class="event-main">
		<div class="event-top">
			<h3 class="event-title">{event.title}</h3>
			{#if event.tag}<span class="event-tag">{event.tag}</span>{/if}
		</div>
		{#if event.description}<p class="event-desc">{event.description}</p>{/if}
		<div class="event-meta">
			<span>🕑 {event.weekday}{event.time ? ` · ${event.time}` : ''}</span>
			{#if event.free}<span class="event-free">Gratuit</span>{/if}
		</div>
	</div>
</article>
