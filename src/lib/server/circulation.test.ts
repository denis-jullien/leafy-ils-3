import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from './db/client';
import { runMigrations } from './db/migrate';
import { eq } from 'drizzle-orm';
import { books, families } from './db/schema';
import { familyBarcode } from '$lib/barcodes';
import { MAX_LOANS_PER_FAMILY } from '$lib/config';
import {
	checkout,
	CirculationError,
	renewLoan,
	resolveCode,
	returnBook,
	overdueLoans
} from './circulation';

let db: Db;

function addFamily(name: string, status: 'active' | 'inactive' = 'active') {
	const f = db.insert(families).values({ name, status }).returning().get();
	db.update(families)
		.set({ barcode: familyBarcode(f.id) })
		.where(eq(families.id, f.id))
		.run();
	return f.id;
}
function addBook(title: string, isbn13?: string, rfidUid?: string) {
	return db.insert(books).values({ title, isbn13, barcode: isbn13, rfidUid }).returning().get().id;
}

beforeEach(() => {
	db = createDb(':memory:');
	runMigrations(db);
});

describe('resolveCode', () => {
	it('finds a family by its card', () => {
		const id = addFamily('Dupont');
		const r = resolveCode(db, familyBarcode(id));
		expect(r.kind).toBe('family');
	});

	it('finds a book by ISBN in any form, by internal label and by RFID uid', () => {
		const id = addBook('Le Petit Prince', '9782070612758', 'E00401234567ABCD');
		expect(resolveCode(db, '978-2-07-061275-8').kind).toBe('book');
		expect(resolveCode(db, '2070612759').kind).toBe('book');
		expect(resolveCode(db, `B${String(id).padStart(6, '0')}`).kind).toBe('book');
		expect(resolveCode(db, 'e0:04:01:23:45:67:ab:cd').kind).toBe('book');
		expect(resolveCode(db, 'nonsense').kind).toBe('unknown');
	});
});

describe('checkout / return', () => {
	it('lends, blocks a second loan of the same book, then returns it', () => {
		const fam = addFamily('Martin');
		const other = addFamily('Durand');
		const book = addBook('Dune', '9780441172719');

		const [loan] = checkout(db, { familyId: fam, bookIds: [book] });
		expect(loan.dueAt.getTime()).toBeGreaterThan(Date.now());

		expect(() => checkout(db, { familyId: other, bookIds: [book] })).toThrowError(CirculationError);

		const r = resolveCode(db, '9780441172719');
		expect(r.kind === 'book' && r.openLoan?.family.name).toBe('Martin');

		const returned = returnBook(db, book);
		expect(returned.family.id).toBe(fam);
		expect(() => returnBook(db, book)).toThrowError(/not on loan/);
		expect(checkout(db, { familyId: other, bookIds: [book] })).toHaveLength(1);
	});

	it('is all-or-nothing and enforces the family limit', () => {
		const fam = addFamily('Petit');
		const ids = Array.from({ length: MAX_LOANS_PER_FAMILY + 1 }, (_, i) => addBook(`Book ${i}`));
		expect(() => checkout(db, { familyId: fam, bookIds: ids })).toThrowError(/limit/);
		expect(overdueLoans(db, new Date(Date.now() + 365 * 86400_000))).toHaveLength(0);
	});

	it('refuses inactive families and non-active books', () => {
		const fam = addFamily('Gone', 'inactive');
		const book = addBook('Lost one');
		expect(() => checkout(db, { familyId: fam, bookIds: [book] })).toThrowError(/active/);
		const ok = addFamily('Here');
		db.update(books).set({ status: 'lost' }).run();
		expect(() => checkout(db, { familyId: ok, bookIds: [book] })).toThrowError(/lost/);
	});

	it('renews once and reports overdue loans', () => {
		const fam = addFamily('Late');
		const book = addBook('Slow reader');
		const past = new Date('2026-01-01T10:00:00Z');
		const [loan] = checkout(db, { familyId: fam, bookIds: [book], now: past });
		expect(overdueLoans(db)).toHaveLength(1);
		renewLoan(db, loan.id);
		expect(overdueLoans(db)).toHaveLength(0);
		expect(() => renewLoan(db, loan.id)).toThrowError(/renewed/);
	});
});
