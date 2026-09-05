<script lang="ts">
	import { CONTACT } from '$lib/content/site';

	interface Props {
		event: {
			day: string;
			month: string;
			weekday: string;
			time: string;
			title: string;
			tag: string;
			desc: string;
			free?: boolean;
		};
	}
	let { event }: Props = $props();
	const mailto = $derived(
		`mailto:${CONTACT.email}?subject=${encodeURIComponent(`Inscription : ${event.title} (${event.weekday} ${event.day} ${event.month})`)}`
	);
</script>

<article class="event">
	<div class="event-date">
		<span class="ed-day">{event.day}</span>
		<span class="ed-month">{event.month}</span>
	</div>
	<div class="event-main">
		<div class="event-top">
			<h3 class="event-title">{event.title}</h3>
			<span class="event-tag">{event.tag}</span>
		</div>
		<p class="event-desc">{event.desc}</p>
		<div class="event-meta">
			<span>🕑 {event.weekday} · {event.time}</span>
			{#if event.free}<span class="event-free">Gratuit</span>{/if}
		</div>
	</div>
	<a class="event-cta" href={mailto}>Je m'inscris</a>
</article>
