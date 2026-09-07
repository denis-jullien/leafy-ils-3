/**
 * Deposits: batches of books lent by the departmental library and exchanged on
 * fixed dates. A book with a deposit belongs to the lender; one without is the
 * library's own. Families borrow both the same way, but a deposit book must be
 * back before its deposit goes back (see the due-date cap in circulation.ts).
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Db } from './db/client';
import {
	books,
	depositMoves,
	deposits,
	families,
	loans,
	type Book,
	type Deposit
} from './db/schema';
import { DEPOSIT_MARGIN_DAYS } from '$lib/config';
import { parseListText } from '$lib/deposit-list';
import { parseIsbn } from '$lib/isbn';

export class DepositError extends Error {
	constructor(
		public code: 'NOT_FOUND' | 'CLOSED' | 'BOOKS_LEFT' | 'HAS_BOOKS' | 'BAD_TARGET',
		message: string
	) {
		super(message);
	}
}

export interface DepositInput {
	label: string;
	receivedOn: string;
	returnOn: string;
	notes?: string | null;
}

/** What is where, for one deposit. */
export interface DepositCounts {
	/** Books currently in the deposit: on the shelf or out with a family. */
	active: number;
	onLoan: number;
	/** Handed back to the lender. */
	returned: number;
	/** Lost or withdrawn while here: to be declared to the lender. */
	missing: number;
}

export type DepositWithCounts = Deposit & DepositCounts;

const openLoanJoin = sql`${loans.bookId} = ${books.id} AND ${loans.returnedAt} IS NULL`;

const countCols = {
	active: sql<number>`coalesce(sum(${books.status} = 'active'), 0)`,
	onLoan: sql<number>`coalesce(sum(${books.status} = 'active' AND ${loans.id} IS NOT NULL), 0)`,
	returned: sql<number>`coalesce(sum(${books.status} = 'returned'), 0)`,
	missing: sql<number>`coalesce(sum(${books.status} IN ('lost', 'withdrawn')), 0)`
};

/** Open deposits first, soonest return first; closed ones after, most recent first. */
export function listDeposits(db: Db): DepositWithCounts[] {
	return db
		.select({ deposit: deposits, ...countCols })
		.from(deposits)
		.leftJoin(books, eq(books.depositId, deposits.id))
		.leftJoin(loans, openLoanJoin)
		.groupBy(deposits.id)
		.orderBy(
			sql`${deposits.closedAt} IS NOT NULL`,
			sql`CASE WHEN ${deposits.closedAt} IS NULL THEN ${deposits.returnOn} END`,
			desc(deposits.returnOn)
		)
		.all()
		.map(({ deposit, ...counts }) => ({ ...deposit, ...counts }));
}

export function openDeposits(db: Db): Deposit[] {
	return db
		.select()
		.from(deposits)
		.where(isNull(deposits.closedAt))
		.orderBy(asc(deposits.returnOn))
		.all();
}

export function getDeposit(db: Db, id: number): DepositWithCounts | undefined {
	return listDeposits(db).find((d) => d.id === id);
}

export function createDeposit(db: Db, input: DepositInput): Deposit {
	return db
		.insert(deposits)
		.values({ ...input, notes: input.notes ?? null })
		.returning()
		.get();
}

export function updateDeposit(db: Db, id: number, input: DepositInput): Deposit {
	return db
		.update(deposits)
		.set({ ...input, notes: input.notes ?? null })
		.where(eq(deposits.id, id))
		.returning()
		.get();
}

/** Only a deposit nothing ever went through can be deleted; the rest is history. */
export function deleteDeposit(db: Db, id: number) {
	const used =
		db.select({ id: books.id }).from(books).where(eq(books.depositId, id)).get() ??
		db
			.select({ id: depositMoves.id })
			.from(depositMoves)
			.where(eq(depositMoves.depositId, id))
			.get();
	if (used)
		throw new DepositError(
			'HAS_BOOKS',
			'Des livres sont passés par ce dépôt : il reste dans l’historique.'
		);
	db.delete(deposits).where(eq(deposits.id, id)).run();
}

/* ---------- Dates ---------- */

/** An ISO date `months` later, clamped to the end of a shorter month. */
export function plusMonths(iso: string, months: number): string {
	const d = new Date(`${iso}T12:00:00Z`);
	const day = d.getUTCDate();
	d.setUTCDate(1);
	d.setUTCMonth(d.getUTCMonth() + months);
	const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
	d.setUTCDate(Math.min(day, last));
	return d.toISOString().slice(0, 10);
}

/** "Échange de septembre 2026": the default name of a deposit received today. */
export function defaultDepositLabel(iso: string): string {
	const month = new Intl.DateTimeFormat('fr-FR', {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(new Date(`${iso}T12:00:00Z`));
	return `Échange de ${month}`;
}

/** The last moment a deposit book may be due back from a family: the return date minus the margin. */
export function depositLoanCap(
	deposit: { returnOn: string },
	marginDays = DEPOSIT_MARGIN_DAYS
): Date {
	const d = new Date(`${deposit.returnOn}T23:59:59`);
	d.setDate(d.getDate() - marginDays);
	return d;
}

/* ---------- The books of a deposit ---------- */

export type DepositBookState = 'shelf' | 'loan' | 'returned' | 'lost' | 'withdrawn';

export interface DepositBookRow {
	book: Book;
	state: DepositBookState;
	loan: {
		id: number;
		dueAt: Date;
		family: { id: number; name: string; phone: string | null };
	} | null;
}

const STATE_ORDER: Record<DepositBookState, number> = {
	loan: 0,
	shelf: 1,
	lost: 2,
	withdrawn: 2,
	returned: 3
};

/** Out with families first, then on the shelf, then what cannot go back, then what already did. */
export function depositBooks(db: Db, depositId: number): DepositBookRow[] {
	return db
		.select({
			book: books,
			loanId: loans.id,
			dueAt: loans.dueAt,
			familyId: families.id,
			familyName: families.name,
			familyPhone: families.phone
		})
		.from(books)
		.leftJoin(loans, openLoanJoin)
		.leftJoin(families, eq(families.id, loans.familyId))
		.where(eq(books.depositId, depositId))
		.all()
		.map((r) => {
			const loan =
				r.loanId && r.dueAt && r.familyId
					? {
							id: r.loanId,
							dueAt: r.dueAt,
							family: { id: r.familyId, name: r.familyName!, phone: r.familyPhone }
						}
					: null;
			const state: DepositBookState =
				r.book.status !== 'active' ? r.book.status : loan ? 'loan' : 'shelf';
			return { book: r.book, state, loan };
		})
		.sort(
			(a, b) =>
				STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
				a.book.title.localeCompare(b.book.title, 'fr')
		);
}

/* ---------- Scanning books in and out ---------- */

const bookByBarcode = (db: Db, code: string) =>
	db.select().from(books).where(eq(books.barcode, code)).get();

const requireOpen = (db: Db, id: number) => {
	const dep = db.select().from(deposits).where(eq(deposits.id, id)).get();
	if (!dep) throw new DepositError('NOT_FOUND', 'Dépôt introuvable');
	if (dep.closedAt) throw new DepositError('CLOSED', 'Ce dépôt est clôturé');
	return dep;
};

export type ReceiveResult =
	/** Nothing wears this sticker yet: the book has to be added. */
	| { kind: 'unknown'; barcode: string }
	/** The ISBN was scanned instead of the lender's sticker. */
	| { kind: 'isbn'; isbn: string }
	| { kind: 'already'; book: Book }
	/** Seen in an earlier deposit and handed back since: it is back, same record. */
	| { kind: 'reactivated'; book: Book }
	/** Kept from a deposit still open: it now belongs to this one. */
	| { kind: 'transferred'; book: Book; from: Deposit }
	| { kind: 'own'; book: Book };

/**
 * A sticker scanned at reception. Known books come back on their own record,
 * whichever deposit they last went through; unknown ones are for the form.
 */
export function receiveBook(
	db: Db,
	depositId: number,
	raw: string,
	userId?: string
): ReceiveResult {
	requireOpen(db, depositId);
	const code = raw.trim();
	const book = bookByBarcode(db, code);
	if (!book) {
		const isbn = parseIsbn(code);
		return isbn ? { kind: 'isbn', isbn } : { kind: 'unknown', barcode: code };
	}
	if (book.depositId === null) return { kind: 'own', book };
	if (book.depositId === depositId && book.status === 'active') return { kind: 'already', book };
	const from =
		book.depositId === depositId
			? null
			: db.select().from(deposits).where(eq(deposits.id, book.depositId)).get();
	const updated = db.transaction((tx) => {
		const b = tx
			.update(books)
			.set({ depositId, status: 'active' })
			.where(eq(books.id, book.id))
			.returning()
			.get();
		tx.insert(depositMoves).values({ depositId, bookId: book.id, kind: 'in', by: userId }).run();
		return b;
	});
	return from && !from.closedAt && book.status === 'active'
		? { kind: 'transferred', book: updated, from }
		: { kind: 'reactivated', book: updated };
}

export type ReturnResult =
	| { kind: 'unknown'; barcode: string }
	/** An ISBN was scanned and it names no single deposit book: the sticker is needed. */
	| { kind: 'isbn'; isbn: string }
	| { kind: 'own'; book: Book }
	| { kind: 'already'; book: Book }
	/** Still out: the family has to bring it back first. */
	| { kind: 'on_loan'; book: Book; family: { id: number; name: string }; dueAt: Date }
	/** Into the crate. `from` is set when the book sat in another open deposit. */
	| { kind: 'returned'; book: Book; from: Deposit | null };

/** A sticker scanned while packing the crate that goes back to the lender. */
export function returnToLender(
	db: Db,
	depositId: number,
	raw: string,
	userId?: string
): ReturnResult {
	requireOpen(db, depositId);
	const code = raw.trim();
	let book = bookByBarcode(db, code);
	if (!book) {
		// A sticker that will not scan: the ISBN does when it names exactly one deposit book still here.
		const isbn = parseIsbn(code);
		if (!isbn) return { kind: 'unknown', barcode: code };
		const hits = db
			.select()
			.from(books)
			.where(and(eq(books.isbn13, isbn), isNotNull(books.depositId), eq(books.status, 'active')))
			.all();
		if (hits.length !== 1) return { kind: 'isbn', isbn };
		book = hits[0];
	}
	if (book.depositId === null) return { kind: 'own', book };
	if (book.status === 'returned') return { kind: 'already', book };
	const open = db
		.select({ dueAt: loans.dueAt, familyId: families.id, familyName: families.name })
		.from(loans)
		.innerJoin(families, eq(families.id, loans.familyId))
		.where(and(eq(loans.bookId, book.id), isNull(loans.returnedAt)))
		.get();
	if (open)
		return {
			kind: 'on_loan',
			book,
			family: { id: open.familyId, name: open.familyName },
			dueAt: open.dueAt
		};
	const from =
		book.depositId === depositId
			? null
			: (db.select().from(deposits).where(eq(deposits.id, book.depositId)).get() ?? null);
	const updated = db.transaction((tx) => {
		const b = tx
			.update(books)
			.set({ status: 'returned' })
			.where(eq(books.id, book.id))
			.returning()
			.get();
		tx.insert(depositMoves)
			.values({ depositId: book.depositId!, bookId: book.id, kind: 'out', by: userId })
			.run();
		return b;
	});
	return { kind: 'returned', book: updated, from };
}

/**
 * Close a deposit once the crate has gone. Books still here (kept on purpose,
 * or still out with a family) move to another open deposit and go back with it.
 */
export function closeDeposit(
	db: Db,
	id: number,
	moveTo: number | null,
	userId?: string
): { moved: number } {
	requireOpen(db, id);
	const left = db
		.select({ id: books.id })
		.from(books)
		.where(and(eq(books.depositId, id), eq(books.status, 'active')))
		.all()
		.map((b) => b.id);
	let target: Deposit | undefined;
	if (left.length) {
		if (moveTo === null)
			throw new DepositError(
				'BOOKS_LEFT',
				`${left.length} livre(s) sont encore ici : choisissez le dépôt qui les garde.`
			);
		target = db.select().from(deposits).where(eq(deposits.id, moveTo)).get();
		if (!target || target.closedAt || target.id === id)
			throw new DepositError(
				'BAD_TARGET',
				'Le dépôt de destination doit être un autre dépôt ouvert.'
			);
	}
	db.transaction((tx) => {
		if (target) {
			tx.update(books).set({ depositId: target.id }).where(inArray(books.id, left)).run();
			tx.insert(depositMoves)
				.values(
					left.map((bookId) => ({ depositId: target!.id, bookId, kind: 'in' as const, by: userId }))
				)
				.run();
		}
		tx.update(deposits).set({ closedAt: new Date() }).where(eq(deposits.id, id)).run();
	});
	return { moved: left.length };
}

/* ---------- Checking against the lender's list ---------- */

export interface ListComparison {
	/** Lines of the lender's list that looked like a book. */
	theirs: number;
	/** Books of the deposit found on their list. */
	matched: number;
	/** Their lines that match none of the books received here. */
	missing: string[];
	/** Books received here that are on none of their lines. */
	extra: { id: number; title: string; barcode: string | null }[];
}

/**
 * Match the lender's pasted list against what was scanned into the deposit,
 * whatever became of the books since. A line matches a book when any code on
 * it is the book's sticker or ISBN.
 */
export function compareWithList(db: Db, depositId: number, text: string): ListComparison {
	const received = db
		.select({ id: books.id, title: books.title, barcode: books.barcode, isbn13: books.isbn13 })
		.from(books)
		.where(eq(books.depositId, depositId))
		.all();
	const byCode = new Map<string, (typeof received)[number]>();
	for (const b of received) {
		if (b.barcode) byCode.set(b.barcode.toUpperCase(), b);
		if (b.isbn13) byCode.set(b.isbn13, b);
	}
	const hit = new Set<number>();
	const missing: string[] = [];
	let matchedLines = 0;
	for (const line of parseListText(text)) {
		const book = line.tokens
			.map((t) => byCode.get(t.toUpperCase()) ?? byCode.get(parseIsbn(t) ?? ''))
			.find(Boolean);
		if (book) {
			hit.add(book.id);
			matchedLines++;
		} else missing.push(line.raw.length > 90 ? `${line.raw.slice(0, 87)}…` : line.raw);
	}
	return {
		theirs: matchedLines + missing.length,
		matched: hit.size,
		missing,
		extra: received
			.filter((b) => !hit.has(b.id))
			.map(({ id, title, barcode }) => ({ id, title, barcode }))
			.sort((a, b) => a.title.localeCompare(b.title, 'fr'))
	};
}
