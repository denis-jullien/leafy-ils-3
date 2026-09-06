/** URL helpers for server-sorted, server-filtered lists. State lives in the query string. */

export const PAGE_SIZE = 50;

export type Dir = 'asc' | 'desc';

export interface Listing<S extends string> {
	q: string;
	sort: S;
	dir: Dir;
	page: number;
}

/** Read sort, direction and page from the URL, falling back to sane defaults. */
export function parseListing<S extends string>(
	url: URL,
	sorts: readonly S[],
	defaultSort: S,
	defaultDir: Dir = 'asc'
): Listing<S> {
	const sortRaw = url.searchParams.get('sort') as S | null;
	const sort = sortRaw && sorts.includes(sortRaw) ? sortRaw : defaultSort;
	const dirRaw = url.searchParams.get('dir');
	const dir: Dir =
		dirRaw === 'asc' || dirRaw === 'desc' ? dirRaw : sort === defaultSort ? defaultDir : 'asc';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	return { q: url.searchParams.get('q')?.trim() ?? '', sort, dir, page };
}

/** Same URL with some params changed. Any change other than the page resets the page. */
export function withParams(
	url: URL,
	changes: Record<string, string | number | null | undefined>
): string {
	const p = new URLSearchParams(url.searchParams);
	if (!('page' in changes)) p.delete('page');
	for (const [k, v] of Object.entries(changes)) {
		if (v === null || v === undefined || v === '') p.delete(k);
		else p.set(k, String(v));
	}
	const s = p.toString();
	return s ? `?${s}` : url.pathname;
}

/** Link that sorts by a column, flipping the direction when it is already the active sort. */
export function sortHref(url: URL, key: string, current: { sort: string; dir: Dir }): string {
	const dir = current.sort === key && current.dir === 'asc' ? 'desc' : 'asc';
	return withParams(url, { sort: key, dir });
}

export const pageCount = (total: number, size = PAGE_SIZE) => Math.max(1, Math.ceil(total / size));
