import { and, asc, eq, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from './db/client';
import { books, families, loans, type Book, type Family, type Loan } from './db/schema';
import { LOAN_MONTHS, MAX_LOANS_PER_FAMILY, MAX_RENEWALS } from '$lib/config';
import { normalizeRfidUid, parseBookBarcode, parseFamilyBarcode } from '$lib/barcodes';
import { parseIsbn } from '$lib/isbn';
import { BOOK_STATUS } from '$lib/labels';

export class CirculationError extends Error {
	constructor(
		public code:
			| 'FAMILY_NOT_FOUND'
			| 'FAMILY_INACTIVE'
			| 'BOOK_NOT_FOUND'
			| 'BOOK_UNAVAILABLE'
			| 'ALREADY_ON_LOAN'
			| 'NOT_ON_LOAN'
			| 'LOAN_LIMIT'
			| 'RENEWAL_LIMIT',
		message: string
	) {
		super(message);
	}
}

export type OpenLoan = Loan & { family: Family };
export type Resolved =
	| { kind: 'family'; family: Family; openLoans: (Loan & { book: Book })[] }
	| { kind: 'book'; book: Book; openLoan: OpenLoan | null }
	| { kind: 'unknown'; code: string };

const openLoanOf = (db: Db, bookId: number): OpenLoan | null => {
	const row = db
		.select({ loan: loans, family: families })
		.from(loans)
		.innerJoin(families, eq(families.id, loans.familyId))
		.where(and(eq(loans.bookId, bookId), isNull(loans.returnedAt)))
		.get();
	return row ? { ...row.loan, family: row.family } : null;
};

export function openLoansForFamily(db: Db, familyId: number) {
	return db
		.select({ loan: loans, book: books })
		.from(loans)
		.innerJoin(books, eq(books.id, loans.bookId))
		.where(and(eq(loans.familyId, familyId), isNull(loans.returnedAt)))
		.orderBy(asc(loans.dueAt))
		.all()
		.map((r) => ({ ...r.loan, book: r.book }));
}

export function overdueLoans(db: Db, now = new Date()) {
	return db
		.select({ loan: loans, book: books, family: families })
		.from(loans)
		.innerJoin(books, eq(books.id, loans.bookId))
		.innerJoin(families, eq(families.id, loans.familyId))
		.where(and(isNull(loans.returnedAt), lt(loans.dueAt, now)))
		.orderBy(asc(loans.dueAt))
		.all()
		.map((r) => ({ ...r.loan, book: r.book, family: r.family }));
}

/**
 * Turn whatever was scanned or typed into the thing it identifies.
 * Order matters: family cards and internal labels have unambiguous prefixes,
 * ISBNs have a checksum, and anything else is tried as an RFID UID.
 */
export function resolveCode(db: Db, raw: string): Resolved {
	const code = raw.trim();
	if (!code) return { kind: 'unknown', code };

	const familyId = parseFamilyBarcode(code);
	if (familyId !== null) {
		const family = db.select().from(families).where(eq(families.id, familyId)).get();
		return family
			? { kind: 'family', family, openLoans: openLoansForFamily(db, family.id) }
			: { kind: 'unknown', code };
	}

	let book: Book | undefined;
	const bookId = parseBookBarcode(code);
	if (bookId !== null) {
		book = db.select().from(books).where(eq(books.id, bookId)).get();
	}
	if (!book) {
		const isbn = parseIsbn(code);
		if (isbn) book = db.select().from(books).where(eq(books.isbn13, isbn)).get();
	}
	if (!book) book = db.select().from(books).where(eq(books.barcode, code)).get();
	if (!book) {
		const uid = normalizeRfidUid(code);
		if (uid.length >= 8) book = db.select().from(books).where(eq(books.rfidUid, uid)).get();
	}
	if (!book) return { kind: 'unknown', code };
	return { kind: 'book', book, openLoan: openLoanOf(db, book.id) };
}

/** The same day `months` later (clamped to the end of a shorter month), at the end of that day. */
export function dueDate(from = new Date(), months = LOAN_MONTHS) {
	const d = new Date(from);
	const day = d.getDate();
	d.setDate(1);
	d.setMonth(d.getMonth() + months);
	d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
	d.setHours(23, 59, 59, 0);
	return d;
}

export interface CheckoutInput {
	familyId: number;
	bookIds: number[];
	userId?: string;
	now?: Date;
}

/** Lend several books to one family in a single transaction. All or nothing. */
export function checkout(db: Db, input: CheckoutInput): Loan[] {
	const now = input.now ?? new Date();
	return db.transaction((tx) => {
		const family = tx.select().from(families).where(eq(families.id, input.familyId)).get();
		if (!family) throw new CirculationError('FAMILY_NOT_FOUND', 'Famille introuvable');
		if (family.status !== 'active')
			throw new CirculationError('FAMILY_INACTIVE', `${family.name} n'est pas un abonné actif`);

		const openCount =
			tx
				.select({ n: sql<number>`count(*)` })
				.from(loans)
				.where(and(eq(loans.familyId, family.id), isNull(loans.returnedAt)))
				.get()?.n ?? 0;
		if (MAX_LOANS_PER_FAMILY !== null && openCount + input.bookIds.length > MAX_LOANS_PER_FAMILY)
			throw new CirculationError(
				'LOAN_LIMIT',
				`${family.name} a déjà ${openCount} livre(s) en prêt (maximum ${MAX_LOANS_PER_FAMILY})`
			);

		const created: Loan[] = [];
		for (const bookId of new Set(input.bookIds)) {
			const book = tx.select().from(books).where(eq(books.id, bookId)).get();
			if (!book) throw new CirculationError('BOOK_NOT_FOUND', `Livre ${bookId} introuvable`);
			if (book.status !== 'active')
				throw new CirculationError(
					'BOOK_UNAVAILABLE',
					`« ${book.title} » est ${BOOK_STATUS[book.status]}`
				);
			const open = tx
				.select({ familyId: loans.familyId })
				.from(loans)
				.where(and(eq(loans.bookId, bookId), isNull(loans.returnedAt)))
				.get();
			if (open)
				throw new CirculationError(
					'ALREADY_ON_LOAN',
					`« ${book.title} » est déjà en prêt${open.familyId === family.id ? ' à cette famille' : ''}`
				);
			created.push(
				tx
					.insert(loans)
					.values({
						bookId,
						familyId: family.id,
						checkedOutAt: now,
						dueAt: dueDate(now),
						checkedOutBy: input.userId
					})
					.returning()
					.get()
			);
		}
		return created;
	});
}

/** Return a book. Whoever brings it back, it goes back on the shelf. */
export function returnBook(db: Db, bookId: number, userId?: string, now = new Date()): OpenLoan {
	const open = openLoanOf(db, bookId);
	if (!open) throw new CirculationError('NOT_ON_LOAN', "Ce livre n'est pas en prêt");
	db.update(loans).set({ returnedAt: now, returnedBy: userId }).where(eq(loans.id, open.id)).run();
	return { ...open, returnedAt: now, returnedBy: userId ?? null };
}

/** Close several loans at once, all or nothing. Used by the desk's returns list. */
export function returnLoans(
	db: Db,
	loanIds: number[],
	userId?: string,
	now = new Date()
): OpenLoan[] {
	return db.transaction((tx) => {
		const done: OpenLoan[] = [];
		for (const loanId of new Set(loanIds)) {
			const row = tx
				.select({ loan: loans, family: families, title: books.title })
				.from(loans)
				.innerJoin(families, eq(families.id, loans.familyId))
				.innerJoin(books, eq(books.id, loans.bookId))
				.where(eq(loans.id, loanId))
				.get();
			if (!row) throw new CirculationError('NOT_ON_LOAN', `Prêt ${loanId} introuvable`);
			if (row.loan.returnedAt)
				throw new CirculationError('NOT_ON_LOAN', `« ${row.title} » a déjà été rendu`);
			tx.update(loans)
				.set({ returnedAt: now, returnedBy: userId })
				.where(eq(loans.id, loanId))
				.run();
			done.push({ ...row.loan, returnedAt: now, returnedBy: userId ?? null, family: row.family });
		}
		return done;
	});
}

export function renewLoan(db: Db, loanId: number, now = new Date()): Loan {
	const loan = db.select().from(loans).where(eq(loans.id, loanId)).get();
	if (!loan || loan.returnedAt) throw new CirculationError('NOT_ON_LOAN', 'Ce prêt est terminé');
	if (loan.renewals >= MAX_RENEWALS)
		throw new CirculationError('RENEWAL_LIMIT', `Déjà prolongé ${loan.renewals} fois`);
	return db
		.update(loans)
		.set({ renewals: loan.renewals + 1, dueAt: dueDate(now) })
		.where(eq(loans.id, loanId))
		.returning()
		.get();
}
