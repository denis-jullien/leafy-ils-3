import { asc, desc, eq, gte } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from './db/client';
import { events, type Event } from './db/schema';
import { TIMEZONE } from '$lib/config';
import type { eventSchema } from '$lib/schemas';

export type EventInput = z.infer<typeof eventSchema>;

const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: TIMEZONE });
const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: TIMEZONE });
const weekdayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: TIMEZONE });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Today's ISO date (YYYY-MM-DD) in the library's timezone. */
export function todayIso(now = new Date()) {
	return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(now);
}

/** Add the pieces the public card displays: "16", "SEPT", "Mercredi". */
export function decorateEvent<T extends { date: string }>(e: T) {
	const d = new Date(`${e.date}T12:00:00`);
	return {
		...e,
		day: dayFmt.format(d),
		month: monthFmt.format(d).replace('.', '').toUpperCase(),
		weekday: cap(weekdayFmt.format(d))
	};
}
export type DecoratedEvent = ReturnType<typeof decorateEvent<Event>>;

export function upcomingEvents(db: Db, from = todayIso(), limit = 4): DecoratedEvent[] {
	return db
		.select()
		.from(events)
		.where(gte(events.date, from))
		.orderBy(asc(events.date), asc(events.time))
		.limit(limit)
		.all()
		.map(decorateEvent);
}

/** Every event, newest first, for the desk. */
export function listEvents(db: Db): Event[] {
	return db.select().from(events).orderBy(desc(events.date), desc(events.time)).all();
}

export function getEvent(db: Db, id: number): Event | undefined {
	return db.select().from(events).where(eq(events.id, id)).get();
}

export function createEvent(db: Db, input: EventInput): Event {
	return db.insert(events).values(input).returning().get();
}

export function updateEvent(db: Db, id: number, input: EventInput): Event {
	return db.update(events).set(input).where(eq(events.id, id)).returning().get();
}

export function deleteEvent(db: Db, id: number) {
	db.delete(events).where(eq(events.id, id)).run();
}
