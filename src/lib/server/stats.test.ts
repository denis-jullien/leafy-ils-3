import { describe, expect, it } from 'vitest';
import { bucketByDay, groupActivity, type ActivityEvent } from './stats';

const t = (min: number) => new Date(Date.UTC(2026, 8, 5, 10, min));
const dupont = { id: 1, name: 'Dupont' };
const martin = { id: 2, name: 'Martin' };
const book = (id: number) => ({ id, title: `Livre ${id}` });

describe('groupActivity', () => {
	it('folds loans to the same family within minutes into one line', () => {
		const events: ActivityEvent[] = [
			{ kind: 'loan', at: t(0), family: dupont, book: book(1), by: 'Marie' },
			{ kind: 'loan', at: t(1), family: dupont, book: book(2) },
			{ kind: 'loan', at: t(2), family: martin, book: book(3) },
			{ kind: 'return', at: t(3), family: dupont, book: book(4) },
			{ kind: 'loan', at: t(40), family: dupont, book: book(5) }
		];
		const g = groupActivity(events);
		expect(g.map((x) => [x.kind, x.family?.name, x.books.length])).toEqual([
			['loan', 'Dupont', 1],
			['return', 'Dupont', 1],
			['loan', 'Martin', 1],
			['loan', 'Dupont', 2]
		]);
		expect(g[3].by).toBe('Marie');
		expect(g[0].at).toEqual(t(40));
	});

	it('groups books and families added together', () => {
		const g = groupActivity([
			{ kind: 'book', at: t(0), book: book(1) },
			{ kind: 'book', at: t(2), book: book(2) },
			{ kind: 'family', at: t(3), family: dupont }
		]);
		expect(g.map((x) => x.kind)).toEqual(['family', 'book']);
		expect(g[1].books).toHaveLength(2);
		expect(g[0].families).toEqual([dupont]);
	});
});

describe('bucketByDay', () => {
	it('counts per day and keeps only days with activity, oldest first', () => {
		const key = (d: Date) => d.toISOString().slice(0, 10);
		const days = bucketByDay(
			[new Date('2026-09-05T10:00Z'), new Date('2026-09-05T11:00Z'), new Date('2026-09-02T10:00Z')],
			[new Date('2026-09-05T10:30Z'), new Date('2026-09-09T10:00Z')],
			key
		);
		expect(days).toEqual([
			{ day: '2026-09-02', loans: 1, returns: 0 },
			{ day: '2026-09-05', loans: 2, returns: 1 },
			{ day: '2026-09-09', loans: 0, returns: 1 }
		]);
	});
});
