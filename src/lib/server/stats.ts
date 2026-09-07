import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import type { Db } from './db/client';
import { books, depositMoves, deposits, families, loans, user } from './db/schema';
import { TIMEZONE } from '$lib/config';

/* ---------- Recent activity: what happened at the desk, grouped by batch ---------- */

/** 'receipt' and 'handback' are deposit books arriving from, or going back to, the lender. */
export type ActivityKind = 'loan' | 'return' | 'book' | 'family' | 'receipt' | 'handback';

/** One thing that happened: a book lent or returned, a book or a family added. */
export interface ActivityEvent {
	kind: ActivityKind;
	at: Date;
	/** The family concerned (loans and returns), or the family added. */
	family?: { id: number; name: string };
	/** The deposit concerned (receipts and handbacks). */
	deposit?: { id: number; label: string };
	/** The book concerned (loans, returns, additions). */
	book?: { id: number; title: string };
	/** Volunteer who handled it, when known. */
	by?: string;
}

/** Events of one kind for one family, done within a few minutes: one line on the board. */
export interface ActivityGroup {
	kind: ActivityKind;
	at: Date;
	family?: { id: number; name: string };
	deposit?: { id: number; label: string };
	books: { id: number; title: string }[];
	/** Families added, for the 'family' kind. */
	families: { id: number; name: string }[];
	by?: string;
}

/** Events closer than this, same kind and family, belong to the same batch. */
const BATCH_MS = 15 * 60_000;

/** Fold a newest-first list of events into batches. Pure, for tests. */
export function groupActivity(events: ActivityEvent[]): ActivityGroup[] {
	const groups: ActivityGroup[] = [];
	for (const e of [...events].sort((a, b) => b.at.getTime() - a.at.getTime())) {
		const last = groups.at(-1);
		const sameBatch =
			last &&
			last.kind === e.kind &&
			last.family?.id === e.family?.id &&
			last.deposit?.id === e.deposit?.id &&
			last.at.getTime() - e.at.getTime() < BATCH_MS;
		if (sameBatch) {
			if (e.book && !last.books.some((b) => b.id === e.book!.id)) last.books.push(e.book);
			if (e.kind === 'family' && e.family) last.families.push(e.family);
			last.by ??= e.by;
		} else {
			groups.push({
				kind: e.kind,
				at: e.at,
				family: e.family,
				deposit: e.deposit,
				books: e.book ? [e.book] : [],
				families: e.kind === 'family' && e.family ? [e.family] : [],
				by: e.by
			});
		}
	}
	return groups;
}

export function recentActivity(db: Db, limit = 25): ActivityGroup[] {
	const rows = limit * 4;
	const loanRows = db
		.select({
			checkedOutAt: loans.checkedOutAt,
			returnedAt: loans.returnedAt,
			checkedOutBy: loans.checkedOutBy,
			returnedBy: loans.returnedBy,
			familyId: families.id,
			familyName: families.name,
			bookId: books.id,
			title: books.title
		})
		.from(loans)
		.innerJoin(books, eq(books.id, loans.bookId))
		.innerJoin(families, eq(families.id, loans.familyId))
		.orderBy(desc(loans.checkedOutAt))
		.limit(rows)
		.all();
	const returnRows = db
		.select({
			returnedAt: loans.returnedAt,
			returnedBy: loans.returnedBy,
			familyId: families.id,
			familyName: families.name,
			bookId: books.id,
			title: books.title
		})
		.from(loans)
		.innerJoin(books, eq(books.id, loans.bookId))
		.innerJoin(families, eq(families.id, loans.familyId))
		.where(sql`${loans.returnedAt} is not null`)
		.orderBy(desc(loans.returnedAt))
		.limit(rows)
		.all();
	// Own books added by hand; deposit books arrive through the movement log instead.
	const newBooks = db
		.select({ id: books.id, title: books.title, createdAt: books.createdAt })
		.from(books)
		.where(isNull(books.depositId))
		.orderBy(desc(books.createdAt))
		.limit(rows)
		.all();
	const moves = db
		.select({
			kind: depositMoves.kind,
			at: depositMoves.at,
			by: depositMoves.by,
			bookId: books.id,
			title: books.title,
			depositId: deposits.id,
			label: deposits.label
		})
		.from(depositMoves)
		.innerJoin(books, eq(books.id, depositMoves.bookId))
		.innerJoin(deposits, eq(deposits.id, depositMoves.depositId))
		.orderBy(desc(depositMoves.at))
		.limit(rows)
		.all();
	const newFamilies = db
		.select({ id: families.id, name: families.name, createdAt: families.createdAt })
		.from(families)
		.orderBy(desc(families.createdAt))
		.limit(rows)
		.all();

	const ids = new Set<string>();
	for (const r of loanRows) if (r.checkedOutBy) ids.add(r.checkedOutBy);
	for (const r of returnRows) if (r.returnedBy) ids.add(r.returnedBy);
	for (const r of moves) if (r.by) ids.add(r.by);
	const names = new Map(
		ids.size
			? db
					.select({ id: user.id, name: user.name })
					.from(user)
					.where(inArray(user.id, [...ids]))
					.all()
					.map((u) => [u.id, u.name])
			: []
	);

	const events: ActivityEvent[] = [
		...loanRows.map((r) => ({
			kind: 'loan' as const,
			at: r.checkedOutAt,
			family: { id: r.familyId, name: r.familyName },
			book: { id: r.bookId, title: r.title },
			by: r.checkedOutBy ? names.get(r.checkedOutBy) : undefined
		})),
		...returnRows.map((r) => ({
			kind: 'return' as const,
			at: r.returnedAt!,
			family: { id: r.familyId, name: r.familyName },
			book: { id: r.bookId, title: r.title },
			by: r.returnedBy ? names.get(r.returnedBy) : undefined
		})),
		...newBooks.map((b) => ({
			kind: 'book' as const,
			at: b.createdAt,
			book: { id: b.id, title: b.title }
		})),
		...newFamilies.map((f) => ({
			kind: 'family' as const,
			at: f.createdAt,
			family: { id: f.id, name: f.name }
		})),
		...moves.map((m) => ({
			kind: m.kind === 'in' ? ('receipt' as const) : ('handback' as const),
			at: m.at,
			deposit: { id: m.depositId, label: m.label },
			book: { id: m.bookId, title: m.title },
			by: m.by ? names.get(m.by) : undefined
		}))
	];
	return groupActivity(events).slice(0, limit);
}

/* ---------- Loans per opening day ---------- */

export interface DayActivity {
	/** ISO date in the library's timezone. */
	day: string;
	loans: number;
	returns: number;
}

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE });

/** Count loans and returns per calendar day, keeping only days where something happened. Pure. */
export function bucketByDay(
	checkouts: Date[],
	returns: Date[],
	keyOf: (d: Date) => string = (d) => dayKey.format(d)
): DayActivity[] {
	const days = new Map<string, DayActivity>();
	const bump = (d: Date, field: 'loans' | 'returns') => {
		const day = keyOf(d);
		const row = days.get(day) ?? { day, loans: 0, returns: 0 };
		row[field]++;
		days.set(day, row);
	};
	for (const d of checkouts) bump(d, 'loans');
	for (const d of returns) bump(d, 'returns');
	return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** The last `days` opening days (days with a loan or a return), oldest first. */
export function dailyActivity(db: Db, days = 12, sinceDays = 120): DayActivity[] {
	const since = new Date(Date.now() - sinceDays * 86400_000);
	const rows = db
		.select({ checkedOutAt: loans.checkedOutAt, returnedAt: loans.returnedAt })
		.from(loans)
		.where(or(gte(loans.checkedOutAt, since), gte(loans.returnedAt, since)))
		.all();
	return bucketByDay(
		rows.filter((r) => r.checkedOutAt >= since).map((r) => r.checkedOutAt),
		rows
			.filter((r): r is typeof r & { returnedAt: Date } => !!r.returnedAt && r.returnedAt >= since)
			.map((r) => r.returnedAt)
	).slice(-days);
}

/* ---------- Headline figures ---------- */

export interface HeadlineStats {
	/** The library's own books in the collection. */
	books: number;
	/** Books currently here from the departmental library's deposits. */
	deposited: number;
	families: number;
	onLoan: number;
	overdue: number;
	/** Loans recorded in the last 30 days. */
	loans30: number;
	/** Families with at least one loan in the last 90 days. */
	activeFamilies: number;
}

export function headlineStats(db: Db, now = new Date()): HeadlineStats {
	const d30 = new Date(now.getTime() - 30 * 86400_000);
	const d90 = new Date(now.getTime() - 90 * 86400_000);
	const n = (q: { get(): { n: number } | undefined }) => q.get()?.n ?? 0;
	return {
		books: n(
			db
				.select({ n: count() })
				.from(books)
				.where(and(eq(books.status, 'active'), isNull(books.depositId)))
		),
		deposited: n(
			db
				.select({ n: count() })
				.from(books)
				.where(and(eq(books.status, 'active'), isNotNull(books.depositId)))
		),
		families: n(db.select({ n: count() }).from(families).where(eq(families.status, 'active'))),
		onLoan: n(db.select({ n: count() }).from(loans).where(isNull(loans.returnedAt))),
		overdue: n(
			db
				.select({ n: count() })
				.from(loans)
				.where(and(isNull(loans.returnedAt), lt(loans.dueAt, now)))
		),
		loans30: n(db.select({ n: count() }).from(loans).where(gte(loans.checkedOutAt, d30))),
		activeFamilies: n(
			db
				.select({ n: sql<number>`count(distinct ${loans.familyId})` })
				.from(loans)
				.where(gte(loans.checkedOutAt, d90))
		)
	};
}

/** The titles borrowed most often, all time. */
export function topBooks(db: Db, limit = 5) {
	return db
		.select({ id: books.id, title: books.title, authors: books.authors, n: count(loans.id) })
		.from(loans)
		.innerJoin(books, eq(books.id, loans.bookId))
		.groupBy(books.id)
		.orderBy(desc(count(loans.id)), books.title)
		.limit(limit)
		.all();
}
