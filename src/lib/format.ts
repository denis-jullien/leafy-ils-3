const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const fmtDate = (d: Date | number | string | null | undefined) =>
	d == null ? '' : dateFmt.format(new Date(d));
export const fmtDateTime = (d: Date | number | string | null | undefined) =>
	d == null ? '' : dateTimeFmt.format(new Date(d));
export const isOverdue = (due: Date | number | string, now = Date.now()) =>
	new Date(due).getTime() < now;
