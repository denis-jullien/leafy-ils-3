import { TIMEZONE } from '$lib/config';

const LOCALE = 'fr-FR';
const dateFmt = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' });
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });

export const fmtDate = (d: Date | number | string | null | undefined) =>
	d == null ? '' : dateFmt.format(new Date(d));
export const fmtDateTime = (d: Date | number | string | null | undefined) =>
	d == null ? '' : dateTimeFmt.format(new Date(d));
export const isOverdue = (due: Date | number | string, now = Date.now()) =>
	new Date(due).getTime() < now;

const relFmt = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
const timeFmt = new Intl.DateTimeFormat(LOCALE, { timeStyle: 'short', timeZone: TIMEZONE });
const shortDayFmt = new Intl.DateTimeFormat(LOCALE, {
	weekday: 'short',
	day: 'numeric',
	month: 'short',
	timeZone: TIMEZONE
});
const isoDay = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE });

/** Calendar days between two instants, in the library's timezone. */
function daysApart(a: number, b: number) {
	return Math.round((Date.parse(isoDay.format(b)) - Date.parse(isoDay.format(a))) / 86400_000);
}

/** "à l'instant", "il y a 12 minutes", "il y a 3 heures", "hier à 10:32", "mer. 3 sept. à 10:32". */
export function fmtRelative(d: Date | number | string, now = Date.now()) {
	const t = new Date(d).getTime();
	const min = Math.round((now - t) / 60_000);
	if (min < 1) return "à l'instant";
	if (min < 60) return relFmt.format(-min, 'minute');
	const hours = Math.round(min / 60);
	if (hours < 6) return relFmt.format(-hours, 'hour');
	const days = daysApart(t, now);
	const time = timeFmt.format(t);
	if (days === 0) return `aujourd'hui à ${time}`;
	if (days === 1) return `hier à ${time}`;
	return `${shortDayFmt.format(t)} à ${time}`;
}

/** Whole days from today (library time) to an ISO day; negative once it is past. */
export function daysUntil(iso: string, now = Date.now()): number {
	return Math.round(
		(Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${isoDay.format(now)}T00:00:00Z`)) / 86400_000
	);
}

/** "mer. 3 sept." from an ISO day (YYYY-MM-DD). */
export const fmtDay = (iso: string) => shortDayFmt.format(new Date(`${iso}T12:00:00`));
