const LOCALE = 'fr-FR';
const dateFmt = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' });
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });

export const fmtDate = (d: Date | number | string | null | undefined) =>
	d == null ? '' : dateFmt.format(new Date(d));
export const fmtDateTime = (d: Date | number | string | null | undefined) =>
	d == null ? '' : dateTimeFmt.format(new Date(d));
export const isOverdue = (due: Date | number | string, now = Date.now()) =>
	new Date(due).getTime() < now;
