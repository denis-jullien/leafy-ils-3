import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from './db/client';
import { runMigrations } from './db/migrate';
import { books } from './db/schema';
import { searchCatalogue } from './catalogue';

let db: Db;
beforeEach(() => {
	db = createDb(':memory:');
	runMigrations(db);
	db.insert(books)
		.values([
			{ title: 'D.Gray-man, tome 1', authors: 'Katsura Hoshino', status: 'active' },
			{ title: "Harry Potter à l'école des sorciers", authors: 'J. K. Rowling', status: 'active' },
			{ title: 'Le Père Noël est une ordure', authors: 'Collectif', status: 'active' },
			{ title: 'A Single Thread', authors: 'Tracy Chevalier', status: 'active' },
			{ title: 'Dune', authors: 'Frank Herbert', status: 'withdrawn' }
		])
		.run();
});

const titles = (q: string, fuzzy = true) => searchCatalogue(db, { q, fuzzy }).map((b) => b.title);

describe('public search', () => {
	it('ignores case, accents, punctuation and spacing', () => {
		expect(titles('dgray')).toEqual(['D.Gray-man, tome 1']);
		expect(titles('d. gray')).toEqual(['D.Gray-man, tome 1']);
		expect(titles('pere noel')).toEqual(['Le Père Noël est une ordure']);
		expect(titles('ROWLING')).toEqual(["Harry Potter à l'école des sorciers"]);
	});

	it('matches every word wherever it is, title matches first', () => {
		expect(titles('potter ecole')).toEqual(["Harry Potter à l'école des sorciers"]);
		expect(titles('chevalier thread')).toEqual(['A Single Thread']);
	});

	it('falls back to near misses when nothing matches', () => {
		expect(titles('grey')).toEqual(['D.Gray-man, tome 1']);
		expect(titles('harry poter')).toEqual(["Harry Potter à l'école des sorciers"]);
		expect(titles('chevalié')).toEqual(['A Single Thread']);
		expect(titles('zzzzzz')).toEqual([]);
		expect(titles('grey', false)).toEqual([]);
	});

	it('never shows withdrawn books', () => {
		expect(titles('dune')).toEqual([]);
	});
});
