import { asc, count, eq, sql } from 'drizzle-orm';
import type { Db } from './db/client';
import { books, shelves, type Shelf } from './db/schema';
import { suggestShelf, type ClassifySignals, type ShelfMatch } from '$lib/classify';

export function listShelves(db: Db): Shelf[] {
	return db.select().from(shelves).orderBy(asc(shelves.position), asc(shelves.name)).all();
}

/** Shelves with how many books sit on each, for the desk page. */
export function listShelvesWithCounts(db: Db) {
	return db
		.select({ shelf: shelves, books: count(books.id) })
		.from(shelves)
		.leftJoin(books, eq(books.shelfId, shelves.id))
		.groupBy(shelves.id)
		.orderBy(asc(shelves.position), asc(shelves.name))
		.all();
}

export interface ShelfInput {
	name: string;
	keywords?: string | null;
	dewey?: string | null;
	description?: string | null;
}

export function createShelf(db: Db, input: ShelfInput): Shelf {
	const max =
		db
			.select({ m: sql<number>`coalesce(max(${shelves.position}), 0)` })
			.from(shelves)
			.get()?.m ?? 0;
	return db
		.insert(shelves)
		.values({ ...input, position: max + 1 })
		.returning()
		.get();
}

export function updateShelf(db: Db, id: number, input: Partial<ShelfInput>): Shelf {
	return db.update(shelves).set(input).where(eq(shelves.id, id)).returning().get();
}

/** Books on the shelf are left without a shelf (FK is ON DELETE SET NULL). */
export function deleteShelf(db: Db, id: number) {
	db.delete(shelves).where(eq(shelves.id, id)).run();
}

/** Move a shelf one step up or down in the matching order. */
export function moveShelf(db: Db, id: number, direction: 'up' | 'down') {
	const all = listShelves(db);
	const i = all.findIndex((s) => s.id === id);
	const j = direction === 'up' ? i - 1 : i + 1;
	if (i < 0 || j < 0 || j >= all.length) return;
	[all[i], all[j]] = [all[j], all[i]];
	db.transaction((tx) => {
		all.forEach((s, idx) =>
			tx
				.update(shelves)
				.set({ position: idx + 1 })
				.where(eq(shelves.id, s.id))
				.run()
		);
	});
}

/** Which shelf the rules propose for a looked-up book, if any. */
export function proposeShelf(db: Db, signals: ClassifySignals): ShelfMatch | null {
	return suggestShelf(listShelves(db), signals);
}
