import { createHash } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { languageFromIsbn } from '$lib/isbn';
import { looksBlank } from './cover-check';
import { downloadCover } from './cover-download';
import { imageSize } from './image-size';
import { invLabel, parseInventaire, RELATIVES, type InvEntity } from './inventaire';
import { parseUnimarc, unimarcToBook } from './unimarc';

/**
 * ISBN → bibliographic record + cover. Providers are queried in ISBN_PROVIDERS
 * order and their answers merged: the first provider fills what it knows, the
 * next ones fill the gaps. Covers are collected as candidates and verified by
 * fetching the image, so a placeholder never ends up in the catalogue.
 */
export interface BookMetadata {
	isbn13: string;
	title: string;
	authors: string[];
	publisher?: string;
	publishedYear?: number;
	language?: string;
	pageCount?: number;
	description?: string;
	coverUrl?: string;
	/** Providers that contributed, in order. */
	sources: string[];
	/** Where the cover came from, if any. */
	coverSource?: string;
	/** Subject and genre headings, catalogue categories and coded signals, for shelf matching. */
	subjects: string[];
	/** Dewey-like class numbers. */
	dewey: string[];
}

export type ProviderName = 'bnf' | 'sudoc' | 'inventaire' | 'google' | 'openlibrary';

type Partial = Omit<
	BookMetadata,
	'isbn13' | 'sources' | 'coverUrl' | 'coverSource' | 'subjects' | 'dewey'
> & {
	subjects?: string[];
	dewey?: string[];
	/** Cover candidates, best first. Verified later. */
	covers?: { url: string; source: string }[];
	bnfArk?: string;
};
type Provider = (isbn13: string, signal: AbortSignal) => Promise<Partial | null>;

// Inventaire (and Wikimedia) ask callers to identify themselves with a way to get in touch.
const UA = `leafy-ils/0.1 (village library catalogue; ${env.CONTACT ?? 'https://github.com/denisjullien/leafy-ils'})`;
const get = (url: string, signal: AbortSignal, headers: Record<string, string> = {}) =>
	fetch(url, { signal, headers: { 'User-Agent': UA, ...headers }, redirect: 'follow' });

const yearOf = (s?: string) => {
	const m = s && /(\d{4})/.exec(s);
	return m ? Number(m[1]) : undefined;
};

export const bnfCoverUrl = (ark: string) =>
	`https://catalogue.bnf.fr/couverture?&appName=NE&idArk=${encodeURIComponent(ark)}&couverture=1`;

/* ---------- BnF: SRU, UNIMARC via MarcXchange, cover by ARK ---------- */
const bnf: Provider = async (isbn13, signal) => {
	const query = encodeURIComponent(`bib.fuzzyISBN all "${isbn13}"`);
	const res = await get(
		`https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=${query}&recordSchema=unimarcXchange&maximumRecords=1`,
		signal
	);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const xml = await res.text();
	const record = /<srw:record>([\s\S]*?)<\/srw:record>/.exec(xml)?.[1];
	if (!record) return null;
	const book = unimarcToBook(parseUnimarc(record));
	if (!book) return null;
	const ark = /<srw:recordIdentifier>\s*(ark:\/12148\/\w+)/.exec(record)?.[1] ?? book.bnfArk;
	return { ...book, bnfArk: ark, covers: ark ? [{ url: bnfCoverUrl(ark), source: 'bnf' }] : [] };
};

/* ---------- Sudoc: ISBN → PPN → UNIMARC MARCXML ---------- */
const sudoc: Provider = async (isbn13, signal) => {
	const res = await get(`https://www.sudoc.fr/services/isbn2ppn/${isbn13}`, signal);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const ppn = /<ppn>(\w+)<\/ppn>/.exec(await res.text())?.[1];
	if (!ppn) return null;
	const rec = await get(`https://www.sudoc.fr/${ppn}.xml`, signal);
	if (!rec.ok) throw new Error(`HTTP ${rec.status} for PPN ${ppn}`);
	const book = unimarcToBook(parseUnimarc(await rec.text()));
	if (!book) return null;
	// Sudoc has no cover service, but it often links the BnF record, whose cover we can use.
	return { ...book, covers: book.bnfArk ? [{ url: bnfCoverUrl(book.bnfArk), source: 'bnf' }] : [] };
};

/* ---------- Google Books ---------- */
const google: Provider = async (isbn13, signal) => {
	const key = env.GOOGLE_BOOKS_API_KEY ? `&key=${env.GOOGLE_BOOKS_API_KEY}` : '';
	const res = await get(
		`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}&maxResults=1${key}`,
		signal
	);
	// Without an API key Google shares a small daily quota across many callers and
	// answers 429 often. Set GOOGLE_BOOKS_API_KEY or move it later in ISBN_PROVIDERS.
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = (await res.json()) as {
		items?: { volumeInfo: Record<string, unknown> & { imageLinks?: Record<string, string> } }[];
	};
	const v = json.items?.[0]?.volumeInfo;
	if (!v || typeof v.title !== 'string') return null;
	const thumb = (v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail)?.replace(
		/^http:/,
		'https:'
	);
	return {
		title: v.subtitle ? `${v.title}: ${v.subtitle}` : v.title,
		authors: Array.isArray(v.authors) ? (v.authors as string[]) : [],
		publisher: v.publisher as string | undefined,
		publishedYear: yearOf(v.publishedDate as string | undefined),
		language: v.language as string | undefined,
		pageCount: typeof v.pageCount === 'number' ? v.pageCount : undefined,
		description: v.description as string | undefined,
		subjects: Array.isArray(v.categories) ? (v.categories as string[]) : [],
		// zoom=1 is the ~128px thumbnail; zoom=2 gives a usable ~300px cover when it exists.
		covers: thumb
			? [
					{ url: thumb.replace('zoom=1', 'zoom=2'), source: 'google' },
					{ url: thumb, source: 'google' }
				]
			: []
	};
};

/* ---------- Inventaire.io: open book database on top of Wikidata ---------- */
// Documented API (api.inventaire.io): one call returns the edition and, through
// `relatives`, its work (P629), the work's authors, scenarist, illustrator and
// penciller (P50, P58, P110, P10837) and the publisher (P123).
// Genres (P136) and main subjects (P921) come as Wikidata ids; a second call turns
// them into French labels, which is what the shelf rules match on.
const INVENTAIRE = 'https://inventaire.io/api/entities/by-uris';

async function inventaireEntities(
	uris: string[],
	signal: AbortSignal,
	extra: Record<string, string> = {}
): Promise<Record<string, InvEntity>> {
	const params = new URLSearchParams({ uris: uris.join('|'), lang: 'fr', ...extra });
	const res = await get(`${INVENTAIRE}?${params}`, signal);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = (await res.json()) as { entities?: Record<string, InvEntity> };
	return json.entities ?? {};
}

const inventaire: Provider = async (isbn13, signal) => {
	const ents = await inventaireEntities([`isbn:${isbn13}`], signal, { relatives: RELATIVES });
	const parsed = parseInventaire(ents);
	if (!parsed) return null;
	const { record, labelIds } = parsed;
	if (labelIds.length) {
		try {
			const labels = await inventaireEntities(labelIds, signal, { attributes: 'labels' });
			record.subjects = [
				...new Set([
					...labelIds.map((id) => invLabel(labels[id])).filter((x): x is string => !!x),
					...(record.subjects ?? [])
				])
			];
		} catch (err) {
			console.warn(`[isbn] inventaire labels failed for ${isbn13}:`, (err as Error).message);
		}
	}
	if (record.bnfArk) record.covers?.push({ url: bnfCoverUrl(record.bnfArk), source: 'bnf' });
	return record;
};

/* ---------- Open Library ---------- */
const openlibrary: Provider = async (isbn13, signal) => {
	const res = await get(
		`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn13}&format=json&jscmd=data`,
		signal
	);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = (await res.json()) as Record<string, Record<string, unknown>>;
	const d = json[`ISBN:${isbn13}`];
	if (!d || typeof d.title !== 'string') return null;
	const names = (arr: unknown) =>
		Array.isArray(arr) ? arr.map((x) => (x as { name?: string }).name).filter(Boolean) : [];
	const cover = d.cover as { large?: string; medium?: string } | undefined;
	return {
		title: d.subtitle ? `${d.title}: ${d.subtitle}` : d.title,
		authors: names(d.authors) as string[],
		publisher: (names(d.publishers) as string[])[0],
		publishedYear: yearOf(d.publish_date as string | undefined),
		pageCount: typeof d.number_of_pages === 'number' ? d.number_of_pages : undefined,
		subjects: names(d.subjects) as string[],
		covers: [cover?.large, cover?.medium]
			.filter((u): u is string => !!u)
			.map((url) => ({ url, source: 'openlibrary' }))
	};
};

const providers: Record<ProviderName, Provider> = { bnf, sudoc, inventaire, google, openlibrary };

function providerOrder(): ProviderName[] {
	const raw = env.ISBN_PROVIDERS ?? 'bnf,sudoc,inventaire,google,openlibrary';
	return raw
		.split(',')
		.map((s) => s.trim())
		.filter((s): s is ProviderName => s in providers);
}

/* ---------- Cover verification ---------- */
const MIN_COVER_PX = 100;
/** Sizes known to be "no cover" placeholders: BnF's grey book, Open Library's 1×1 gif. */
const PLACEHOLDER_SIZES = new Set(['92x138', '1x1']);
/** Google's key-free cover URL answers a placeholder image rather than a 404. These are its hashes. */
const PLACEHOLDER_HASHES = new Set([
	'ba8cd5043eedf32e39a4f328a4ec22f8a7dbbaba', // 128×184 "image not available", zoom 1
	'd42f3acc24f36b7e8a3337460d9545e3a22df51a', // 575×750 png, zoom 2
	'cc7313f0f2ac7aa7bc990e3b8bbc9fddd0a19f70', // 128×170 png, unknown ISBN
	'bc6a3a797b93ed6aa75aa73b206e1582bbd9496d', // 300×391 png, zoom 2 of a volume that only has a thumbnail
	'3ad96db4d6f009bae1052492188ef485d69f83ed' // ePagine "pas d'image", 154×173 png
]);
/** Below this width a cover is kept only if nothing larger turns up. */
const SMALL_COVER_PX = 250;

/**
 * ePagine serves the cover images behind most French booksellers' sites and
 * knows nearly every title distributed in France, at up to 600 px. Not a public
 * API: drop it from COVER_SOURCES if its use is ever questioned.
 */
export const epagineCoverUrl = (isbn13: string) =>
	`https://images.epagine.fr/${isbn13.slice(-3)}/${isbn13}_1_75.jpg`;

/** Inventaire's cover alone, for COVER_SOURCES (the record provider above brings it too). */
async function inventaireCover(
	isbn13: string,
	signal: AbortSignal
): Promise<{ url: string; source: string }[]> {
	const ents = await inventaireEntities([`isbn:${isbn13}`], signal, { attributes: 'image' });
	const img = Object.values(ents)[0]?.image?.url;
	return img
		? [{ url: img.startsWith('http') ? img : `https://inventaire.io${img}`, source: 'inventaire' }]
		: [];
}

/** Cover straight from Google Books by ISBN, no API key and no quota. Placeholders are filtered. */
export const googleCoverUrl = (isbn13: string, zoom: 1 | 2) =>
	`https://books.google.com/books/content?vid=ISBN${isbn13}&printsec=frontcover&img=1&zoom=${zoom}`;

/**
 * Verified cover bytes are kept for a few minutes so that saving the book right
 * after the lookup does not download the image a second time.
 */
const recentCovers = new Map<string, { bytes: Uint8Array; at: number }>();
const RECENT_TTL_MS = 10 * 60 * 1000;
const RECENT_MAX = 50;

export function takeCachedCover(url: string): Uint8Array | null {
	const hit = recentCovers.get(url);
	if (!hit) return null;
	recentCovers.delete(url);
	return Date.now() - hit.at < RECENT_TTL_MS ? hit.bytes : null;
}

function rememberCover(url: string, bytes: Uint8Array) {
	const now = Date.now();
	for (const [k, v] of recentCovers) if (now - v.at > RECENT_TTL_MS) recentCovers.delete(k);
	if (recentCovers.size >= RECENT_MAX) recentCovers.delete(recentCovers.keys().next().value!);
	recentCovers.set(url, { bytes, at: now });
}

/** Fetch the image and accept it only if it decodes to a real cover. */
/** Fetches a candidate and answers its size when it is a real cover, null otherwise. */
export async function verifyCover(
	url: string,
	signal: AbortSignal
): Promise<{ width: number; height: number } | null> {
	try {
		const buf = await downloadCover(url, { signal, userAgent: UA });
		const size = imageSize(buf);
		if (!size) return null;
		if (PLACEHOLDER_SIZES.has(`${size.width}x${size.height}`)) return null;
		if (PLACEHOLDER_HASHES.has(createHash('sha1').update(buf).digest('hex'))) return null;
		// Google's zoom-2 placeholder is a PNG at exactly this size; real covers are JPEGs.
		if (size.type === 'png' && size.width === 575 && size.height === 750) return null;
		// ePagine's placeholder, in case its bytes ever change.
		if (size.type === 'png' && size.width === 154 && size.height === 173) return null;
		if (size.width < MIN_COVER_PX || size.height < MIN_COVER_PX) return null;
		// Google draws "image not available" on demand at any size: catch it by its look.
		if (await looksBlank(buf)) return null;
		rememberCover(url, buf);
		return { width: size.width, height: size.height };
	} catch {
		return null;
	}
}

/**
 * Web image search, last resort. Two providers, both optional:
 *  - Brave Search API (BRAVE_SEARCH_KEY): open to anyone, free tier.
 *  - Google Custom Search JSON API (GOOGLE_CSE_KEY + GOOGLE_CSE_ID): closed to new
 *    customers since 2025, kept for those who already have access.
 */
async function braveImageCovers(
	isbn13: string,
	signal: AbortSignal
): Promise<{ url: string; source: string }[]> {
	if (!env.BRAVE_SEARCH_KEY) return [];
	const res = await get(
		`https://api.search.brave.com/res/v1/images/search?q=${isbn13}&count=6&country=FR&search_lang=fr&safesearch=strict`,
		signal,
		{ Accept: 'application/json', 'X-Subscription-Token': env.BRAVE_SEARCH_KEY }
	);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = (await res.json()) as {
		results?: { url?: string; properties?: { url?: string }; thumbnail?: { src?: string } }[];
	};
	const out: { url: string; source: string }[] = [];
	for (const r of json.results ?? []) {
		// properties.url is the full-size image on the page; the thumbnail is Brave's cached copy.
		for (const u of [r.properties?.url, r.thumbnail?.src]) {
			if (u && /^https?:/.test(u) && !/no-?image/i.test(u)) out.push({ url: u, source: 'brave' });
		}
	}
	return out;
}

/** Google Custom Search images, when GOOGLE_CSE_KEY and GOOGLE_CSE_ID are set. */
async function googleImageCovers(
	isbn13: string,
	signal: AbortSignal
): Promise<{ url: string; source: string }[]> {
	if (!env.GOOGLE_CSE_KEY || !env.GOOGLE_CSE_ID) return [];
	const res = await get(
		`https://www.googleapis.com/customsearch/v1?key=${env.GOOGLE_CSE_KEY}&cx=${env.GOOGLE_CSE_ID}&searchType=image&num=5&gl=fr&fields=items(link,mime)&q=${isbn13}`,
		signal
	);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = (await res.json()) as { items?: { link: string; mime?: string }[] };
	return (json.items ?? [])
		.filter((i) => /^https?:/.test(i.link) && !/no-?image/i.test(i.link))
		.map((i) => ({ url: i.link, source: 'googleimages' }));
}

const complete = (m: Partial) =>
	!!(
		m.title &&
		m.authors.length &&
		m.publisher &&
		m.publishedYear &&
		m.description &&
		m.covers?.length
	);

function merge(into: Partial, from: Partial): Partial {
	return {
		title: into.title || from.title,
		authors: into.authors.length ? into.authors : from.authors,
		publisher: into.publisher ?? from.publisher,
		publishedYear: into.publishedYear ?? from.publishedYear,
		language: into.language ?? from.language,
		pageCount: into.pageCount ?? from.pageCount,
		description: into.description ?? from.description,
		bnfArk: into.bnfArk ?? from.bnfArk,
		covers: [...(into.covers ?? []), ...(from.covers ?? [])],
		subjects: [...new Set([...(into.subjects ?? []), ...(from.subjects ?? [])])],
		dewey: [...new Set([...(into.dewey ?? []), ...(from.dewey ?? [])])]
	};
}

export interface LookupOptions {
	timeoutMs?: number;
	/** Skip the record providers and only look for a cover (used to fill missing covers). */
	coverOnly?: boolean;
}

export async function lookupIsbn(
	isbn13: string,
	opts: LookupOptions = {}
): Promise<BookMetadata | null> {
	const timeoutMs = opts.timeoutMs ?? 8000;
	const withTimeout = async <T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> => {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), timeoutMs);
		try {
			return await fn(ctrl.signal);
		} finally {
			clearTimeout(timer);
		}
	};

	let merged: Partial | null = null;
	const sources: string[] = [];
	for (const name of providerOrder()) {
		if (merged && complete(merged)) break;
		try {
			const hit = await withTimeout((s) => providers[name](isbn13, s));
			if (!hit) continue;
			sources.push(name);
			merged = merged ? merge(merged, hit) : hit;
		} catch (err) {
			console.warn(`[isbn] ${name} failed for ${isbn13}:`, (err as Error).message);
		}
	}
	if (!merged && !opts.coverOnly) return null;

	// Cover: candidates from the records first, then sources that work from the ISBN alone,
	// in COVER_SOURCES order. Each candidate is verified before it wins.
	const candidates = [...(merged?.covers ?? [])];
	const seen = new Set<string>();
	const byIsbn: Record<string, (s: AbortSignal) => Promise<{ url: string; source: string }[]>> = {
		epagine: async () => [{ url: epagineCoverUrl(isbn13), source: 'epagine' }],
		openlibrary: async () => [
			{
				url: `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg?default=false`,
				source: 'openlibrary'
			}
		],
		google: async () => [
			{ url: googleCoverUrl(isbn13, 2), source: 'google' },
			{ url: googleCoverUrl(isbn13, 1), source: 'google' }
		],
		inventaire: (sig) => inventaireCover(isbn13, sig),
		brave: (sig) => braveImageCovers(isbn13, sig),
		googleimages: (sig) => googleImageCovers(isbn13, sig)
	};
	const order = (env.COVER_SOURCES ?? 'epagine,openlibrary,google,inventaire,brave,googleimages')
		.split(',')
		.map((x) => x.trim())
		.filter((x) => x in byIsbn);
	for (const name of order) {
		try {
			candidates.push(...(await withTimeout((sig) => byIsbn[name](sig))));
		} catch (err) {
			console.warn(`[isbn] ${name} failed for ${isbn13}:`, (err as Error).message);
		}
	}
	// First real cover of a decent size wins. A thumbnail-sized one (Google often
	// has only that) is kept aside and used if nothing larger turns up.
	let cover: { url: string; source: string } | undefined;
	let small: { url: string; source: string } | undefined;
	for (const c of candidates) {
		if (seen.has(c.url)) continue;
		seen.add(c.url);
		const size = await withTimeout((s) => verifyCover(c.url, s));
		if (!size) continue;
		if (size.width >= SMALL_COVER_PX) {
			cover = c;
			break;
		}
		small ??= c;
	}
	cover ??= small;

	return {
		isbn13,
		title: merged?.title ?? '',
		authors: merged?.authors ?? [],
		publisher: merged?.publisher,
		publishedYear: merged?.publishedYear,
		language: merged?.language ?? languageFromIsbn(isbn13),
		pageCount: merged?.pageCount,
		description: merged?.description,
		coverUrl: cover?.url,
		coverSource: cover?.source,
		subjects: merged?.subjects ?? [],
		dewey: merged?.dewey ?? [],
		sources
	};
}
