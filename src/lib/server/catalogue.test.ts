import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from './db/client';
import { runMigrations } from './db/migrate';
import { books, shelves } from './db/schema';
import { cataloguePage, cataloguePageHref, searchCatalogue } from './catalogue';

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

	it('ranks title matches before more than 120 alphabetically earlier author matches', () => {
		db.insert(books)
			.values(Array.from({ length: 130 }, (_, i) => ({ title: `A book ${i}`, authors: 'Zebra' })))
			.run();
		db.insert(books).values({ title: 'Zebra adventures' }).run();
		expect(searchCatalogue(db, { q: 'zebra', limit: 1 }).map((b) => b.title)).toEqual([
			'Zebra adventures'
		]);
		expect(cataloguePage(db, { q: 'zebra' }).total).toBe(131);
	});

	it('browses every result across stable pages while respecting shelf and status filters', () => {
		const shelf = db.insert(shelves).values({ name: 'Pagination' }).returning().get();
		db.insert(books)
			.values(
				Array.from({ length: 245 }, (_, i) => ({
					title: `Page ${String(i).padStart(3, '0')}`,
					shelfId: shelf.id
				}))
			)
			.run();
		db.insert(books).values({ title: 'Page hidden', shelfId: shelf.id, status: 'lost' }).run();
		const pages = [1, 2, 3].map((page) =>
			cataloguePage(db, { q: 'page', shelfId: shelf.id, page })
		);
		expect(pages.map((p) => p.books.length)).toEqual([120, 120, 5]);
		expect(pages.every((p) => p.total === 245 && p.pages === 3)).toBe(true);
		expect(new Set(pages.flatMap((p) => p.books.map((b) => b.id))).size).toBe(245);
	});

	it('handles empty searches and invalid or excessive page numbers', () => {
		expect(cataloguePage(db, { page: 2.5 }).page).toBe(1);
		expect(cataloguePage(db, { page: Infinity }).page).toBe(1);
		expect(cataloguePage(db, { page: -1 }).page).toBe(1);
		expect(cataloguePage(db, { q: 'zzzzzz', page: 900 })).toMatchObject({
			books: [],
			total: 0,
			page: 1,
			pages: 1
		});
		expect(cataloguePage(db, { page: 900 }).page).toBe(1);
	});

	it('paginates fuzzy matches and ISBN results', () => {
		db.insert(books)
			.values(Array.from({ length: 125 }, (_, i) => ({ title: `Harry Potter ${i}` })))
			.run();
		const first = cataloguePage(db, { q: 'harry poter', page: 1 });
		const second = cataloguePage(db, { q: 'harry poter', page: 2 });
		expect(first.total).toBe(126);
		expect(second.books.length).toBe(6);
		expect(first.books.some((a) => second.books.some((b) => a.id === b.id))).toBe(false);
		db.insert(books).values({ title: 'ISBN title', isbn13: '9782070612758' }).run();
		expect(cataloguePage(db, { q: '9782070612758' }).books.map((b) => b.title)).toEqual([
			'ISBN title'
		]);
	});

	it('keeps the query and shelf in navigation links', () => {
		const url = new URL('https://library.example/catalogue?q=p%C3%A8re+no%C3%ABl&rayon=4&page=2');
		expect(cataloguePageHref(url, 3)).toBe(
			'/catalogue?q=p%C3%A8re+no%C3%ABl&rayon=4&page=3#resultats'
		);
		expect(cataloguePageHref(url, 1)).toBe('/catalogue?q=p%C3%A8re+no%C3%ABl&rayon=4#resultats');
	});
});
