import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from './db/client';
import { runMigrations } from './db/migrate';
import {
	createEvent,
	decorateEvent,
	deleteEvent,
	listEvents,
	pastEvents,
	upcomingEvents,
	updateEvent
} from './events';

let db: Db;
beforeEach(() => {
	db = createDb(':memory:');
	runMigrations(db);
});

describe('events', () => {
	it('formats the date the way the public card shows it', () => {
		const e = decorateEvent({ date: '2026-09-16' });
		expect(e).toMatchObject({ day: '16', month: 'SEPT', weekday: 'Mercredi' });
	});

	it('lists upcoming events in date order and hides past ones', () => {
		createEvent(db, { date: '2026-10-10', title: 'Rencontre', time: '10h00', free: true });
		createEvent(db, { date: '2026-09-16', title: 'Heure du conte', time: '10h30', free: true });
		createEvent(db, { date: '2026-06-11', title: 'Passé', free: true });
		const up = upcomingEvents(db, '2026-09-05');
		expect(up.map((e) => e.title)).toEqual(['Heure du conte', 'Rencontre']);
		expect(pastEvents(db, '2026-09-05').map((e) => e.title)).toEqual(['Passé']);
		expect(listEvents(db)).toHaveLength(3);
	});

	it('updates and deletes', () => {
		const e = createEvent(db, { date: '2026-09-16', title: 'Brouillon', free: true });
		expect(
			updateEvent(db, e.id, { date: '2026-09-17', title: 'Club de lecture', free: false }).free
		).toBe(false);
		deleteEvent(db, e.id);
		expect(listEvents(db)).toHaveLength(0);
	});
});
