import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { featuredBooks, searchCatalogue } from '$lib/server/catalogue';
import { TIMEZONE } from '$lib/config';
import { pastEvents, upcomingEvents } from '$lib/server/events';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Day of week (0 = Monday) and today's ISO date, in the library's timezone. */
function today(now = new Date()) {
	const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short' }).format(
		now
	);
	const iso = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(now); // YYYY-MM-DD
	return { idx: WEEKDAYS.indexOf(weekday), iso };
}

export const load: PageServerLoad = ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const rayon = Number(url.searchParams.get('rayon')) || null;
	const t = today();
	return {
		q,
		rayon,
		searching: q.length > 0,
		books: q ? searchCatalogue(db, { q, shelfId: rayon }) : featuredBooks(db, rayon),
		events: upcomingEvents(db, t.iso),
		pastEvents: pastEvents(db, t.iso),
		todayIdx: t.idx
	};
};
