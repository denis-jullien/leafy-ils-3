import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { featuredBooks, searchCatalogue } from '$lib/server/catalogue';
import { CATEGORY_IDS, TIMEZONE, type CategoryId } from '$lib/config';
import { EVENTS } from '$lib/content/site';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Day of week (0 = Monday) and today's ISO date, in the library's timezone. */
function today(now = new Date()) {
	const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short' }).format(
		now
	);
	const iso = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(now); // YYYY-MM-DD
	return { idx: WEEKDAYS.indexOf(weekday), iso };
}

const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: TIMEZONE });
const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: TIMEZONE });
const weekdayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: TIMEZONE });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function upcomingEvents(todayIso: string, limit = 4) {
	return EVENTS.filter((e) => e.date >= todayIso)
		.sort((a, b) => a.date.localeCompare(b.date))
		.slice(0, limit)
		.map((e) => {
			const d = new Date(`${e.date}T12:00:00`);
			return {
				...e,
				day: dayFmt.format(d),
				month: monthFmt.format(d).replace('.', '').toUpperCase(),
				weekday: cap(weekdayFmt.format(d))
			};
		});
}

export const load: PageServerLoad = ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const rawCat = url.searchParams.get('cat');
	const category = (CATEGORY_IDS as readonly string[]).includes(rawCat ?? '')
		? (rawCat as CategoryId)
		: null;
	const t = today();
	return {
		q,
		category,
		searching: q.length > 0,
		books: q ? searchCatalogue(db, { q, category }) : featuredBooks(db, category),
		events: upcomingEvents(t.iso),
		todayIdx: t.idx
	};
};
