import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, type Db } from './db/client';
import { runMigrations } from './db/migrate';
import { books, depositMoves, families } from './db/schema';
import { familyBarcode } from '$lib/barcodes';
import { createBook, DuplicateBookError, MissingBarcodeError, type BookInput } from './books';
import { checkout, CirculationError, resolveCode } from './circulation';
import {
	closeDeposit,
	compareWithList,
	createDeposit,
	depositBooks,
	depositLoanCap,
	DepositError,
	listDeposits,
	receiveBook,
	returnToLender
} from './deposits';
import { parseListText } from '$lib/deposit-list';
import { daysUntil } from '$lib/format';

let db: Db;

const spring = { label: 'Échange de mars', receivedOn: '2026-03-15', returnOn: '2026-09-15' };
const autumn = { label: 'Échange de septembre', receivedOn: '2026-09-15', returnOn: '2027-03-15' };

function addFamily(name: string) {
	const f = db.insert(families).values({ name }).returning().get();
	db.update(families)
		.set({ barcode: familyBarcode(f.id) })
		.where(eq(families.id, f.id))
		.run();
	return f.id;
}
/** A book form as the schema would hand it over, with only what the test cares about. */
const input = (p: Partial<BookInput> & { title: string }): BookInput => ({
	publishedYear: null,
	pageCount: null,
	shelfId: null,
	depositId: null,
	status: 'active',
	featured: false,
	...p
});
const depositBook = (depositId: number, barcode: string, title: string, isbn?: string) =>
	createBook(db, input({ title, isbn: isbn ?? null, depositId, barcode }));

beforeEach(() => {
	db = createDb(':memory:');
	runMigrations(db);
});

describe('createBook with a deposit', () => {
	it('keeps the sticker as barcode and logs the arrival', () => {
		const dep = createDeposit(db, spring);
		const b = depositBook(dep.id, 'MDH0001', 'Le Petit Prince', '9782070612758');
		expect(b.barcode).toBe('MDH0001');
		expect(b.depositId).toBe(dep.id);
		expect(db.select().from(depositMoves).all()).toMatchObject([
			{ depositId: dep.id, bookId: b.id, kind: 'in' }
		]);
	});

	it('requires the sticker', () => {
		const dep = createDeposit(db, spring);
		expect(() => createBook(db, input({ title: 'Sans étiquette', depositId: dep.id }))).toThrow(
			MissingBarcodeError
		);
	});

	it('lets a deposit copy share the ISBN of the library’s own copy, once', () => {
		const dep = createDeposit(db, spring);
		const own = createBook(db, input({ title: 'Dune', isbn: '9782266320481' }));
		const theirs = depositBook(dep.id, 'MDH0002', 'Dune', '9782266320481');
		expect(theirs.id).not.toBe(own.id);
		// A second own copy is still refused, and a reused sticker too.
		expect(() => createBook(db, input({ title: 'Dune', isbn: '9782266320481' }))).toThrow(
			DuplicateBookError
		);
		expect(() => depositBook(dep.id, 'MDH0002', 'Autre')).toThrow(DuplicateBookError);
		// Scanning the ISBN at the desk names the library's copy; the sticker names theirs.
		const r = resolveCode(db, '9782266320481');
		expect(r.kind === 'book' && r.book.id).toBe(own.id);
		const s = resolveCode(db, 'MDH0002');
		expect(s.kind === 'book' && s.book.id).toBe(theirs.id);
	});
});

describe('receiveBook', () => {
	it('tells an unknown sticker from an ISBN scanned by mistake', () => {
		const dep = createDeposit(db, spring);
		expect(receiveBook(db, dep.id, 'MDH0009')).toEqual({ kind: 'unknown', barcode: 'MDH0009' });
		expect(receiveBook(db, dep.id, '978-2-07-061275-8')).toEqual({
			kind: 'isbn',
			isbn: '9782070612758'
		});
	});

	it('recognises books already here, the library’s own, and returned ones coming back', () => {
		const dep = createDeposit(db, spring);
		const b = depositBook(dep.id, 'MDH0001', 'Le Petit Prince');
		expect(receiveBook(db, dep.id, 'MDH0001').kind).toBe('already');
		const own = createBook(db, input({ title: 'Nôtre' }));
		expect(receiveBook(db, dep.id, own.barcode!).kind).toBe('own');

		expect(returnToLender(db, dep.id, 'MDH0001').kind).toBe('returned');
		closeDeposit(db, dep.id, null);
		const next = createDeposit(db, autumn);
		const r = receiveBook(db, next.id, 'MDH0001');
		expect(r.kind).toBe('reactivated');
		const again = db.select().from(books).where(eq(books.id, b.id)).get()!;
		expect(again.status).toBe('active');
		expect(again.depositId).toBe(next.id);
		expect(
			db
				.select()
				.from(depositMoves)
				.all()
				.map((m) => m.kind)
		).toEqual(['in', 'out', 'in']);
	});

	it('transfers a book kept from a deposit still open', () => {
		const dep = createDeposit(db, spring);
		depositBook(dep.id, 'MDH0001', 'Gardé');
		const next = createDeposit(db, autumn);
		const r = receiveBook(db, next.id, 'MDH0001');
		expect(r.kind).toBe('transferred');
		expect(r.kind === 'transferred' && r.from.id).toBe(dep.id);
		expect(listDeposits(db).map((d) => [d.label, d.active])).toEqual([
			['Échange de mars', 0],
			['Échange de septembre', 1]
		]);
	});
});

describe('returnToLender and closeDeposit', () => {
	it('refuses a book still out with a family, then closes once everything left is moved', () => {
		const dep = createDeposit(db, spring);
		const out = depositBook(dep.id, 'MDH0001', 'Parti');
		const here = depositBook(dep.id, 'MDH0002', 'Ici');
		depositBook(dep.id, 'MDH0003', 'Gardé');
		const fam = addFamily('Dupont');
		checkout(db, { familyId: fam, bookIds: [out.id], now: new Date('2026-04-01T10:00:00') });

		const r = returnToLender(db, dep.id, 'MDH0001');
		expect(r.kind).toBe('on_loan');
		expect(r.kind === 'on_loan' && r.family.name).toBe('Dupont');
		expect(returnToLender(db, dep.id, 'MDH0002').kind).toBe('returned');
		expect(returnToLender(db, dep.id, 'MDH0002').kind).toBe('already');
		expect(returnToLender(db, dep.id, 'NOPE').kind).toBe('unknown');
		// The ISBN does instead of a sticker when it names one deposit book still here.
		depositBook(dep.id, 'MDH0004', 'Sans étiquette lisible', '9782070612758');
		expect(returnToLender(db, dep.id, '9782070612758').kind).toBe('returned');
		expect(returnToLender(db, dep.id, '9782070612758').kind).toBe('isbn');

		expect(depositBooks(db, dep.id).map((b) => [b.book.title, b.state])).toEqual([
			['Parti', 'loan'],
			['Gardé', 'shelf'],
			['Ici', 'returned'],
			['Sans étiquette lisible', 'returned']
		]);
		expect(() => closeDeposit(db, dep.id, null)).toThrow(DepositError);
		expect(() => closeDeposit(db, dep.id, dep.id)).toThrow(DepositError);

		const next = createDeposit(db, autumn);
		expect(closeDeposit(db, dep.id, next.id)).toEqual({ moved: 2 });
		const after = listDeposits(db);
		expect(after.map((d) => [d.label, d.active, d.onLoan, d.returned, !!d.closedAt])).toEqual([
			['Échange de septembre', 2, 1, 0, false],
			['Échange de mars', 0, 0, 2, true]
		]);
		expect(db.select().from(books).where(eq(books.id, here.id)).get()?.depositId).toBe(dep.id);
		expect(() => receiveBook(db, dep.id, 'MDH0009')).toThrow(DepositError);
	});
});

describe('loans of deposit books', () => {
	it('are due before the deposit goes back, and stop once that is too close', () => {
		const dep = createDeposit(db, spring);
		const b = depositBook(dep.id, 'MDH0001', 'Le Petit Prince');
		const fam = addFamily('Dupont');
		// Early on, the usual two months apply.
		const [early] = checkout(db, {
			familyId: fam,
			bookIds: [b.id],
			now: new Date('2026-04-01T10:00:00')
		});
		expect(early.dueAt).toEqual(new Date('2026-06-01T23:59:59'));
		db.update(books).set({ status: 'active' }).run();
		const c = depositBook(dep.id, 'MDH0002', 'Autre');
		// Two months would land after the return date: the cap wins.
		const [late] = checkout(db, {
			familyId: fam,
			bookIds: [c.id],
			now: new Date('2026-08-01T10:00:00')
		});
		expect(late.dueAt).toEqual(depositLoanCap(dep));
		expect(late.dueAt).toEqual(new Date('2026-09-01T23:59:59'));
		const d = depositBook(dep.id, 'MDH0003', 'Trop tard');
		expect(() =>
			checkout(db, { familyId: fam, bookIds: [d.id], now: new Date('2026-09-05T10:00:00') })
		).toThrow(CirculationError);
	});
});

describe('compareWithList', () => {
	it('matches their lines by sticker or ISBN and reports both directions', () => {
		const dep = createDeposit(db, spring);
		depositBook(dep.id, 'MDH0001', 'Le Petit Prince', '9782070612758');
		depositBook(dep.id, 'MDH0002', 'Dune');
		depositBook(dep.id, 'MDH0003', 'En trop');
		const theirs = [
			'Code;Titre;ISBN',
			'MDH0001;Le Petit Prince;978-2-07-061275-8',
			'MDH0002;Dune;',
			'MDH0004;Oublié à la réception;9782266320481',
			''
		].join('\n');
		// Handed back already: still theirs, still matched.
		returnToLender(db, dep.id, 'MDH0002');
		const c = compareWithList(db, dep.id, theirs);
		expect(c).toEqual({
			theirs: 3,
			matched: 2,
			missing: ['MDH0004;Oublié à la réception;9782266320481'],
			extra: [{ id: 3, title: 'En trop', barcode: 'MDH0003' }]
		});
		// The ISBN alone is enough when their sticker column is wrong.
		expect(compareWithList(db, dep.id, 'XXXX;Le Petit Prince;9782070612758').matched).toBe(1);
	});
});

describe('parseListText', () => {
	it('keeps lines with a code and pulls the codes out of them', () => {
		expect(parseListText('Titre\tCode\nDune\t0001234567\nSans code\n978-2-07-061275-8\n')).toEqual([
			{ raw: 'Dune\t0001234567', tokens: ['0001234567'] },
			{ raw: '978-2-07-061275-8', tokens: ['9782070612758'] }
		]);
	});
});

describe('dates', () => {
	it('counts days to the return date in library time', () => {
		expect(daysUntil('2026-09-15', Date.parse('2026-09-01T12:00:00Z'))).toBe(14);
		expect(daysUntil('2026-09-15', Date.parse('2026-09-20T12:00:00Z'))).toBe(-5);
	});
});
