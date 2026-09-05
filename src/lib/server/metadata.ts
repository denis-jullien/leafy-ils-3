import { env } from '$env/dynamic/private';

/** What an ISBN lookup can tell us. Every field is best-effort. */
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
	source: ProviderName;
}

export type ProviderName = 'google' | 'openlibrary' | 'bnf';
type Provider = (isbn13: string, signal: AbortSignal) => Promise<BookMetadata | null>;

const yearOf = (s?: string) => {
	const m = s && /(\d{4})/.exec(s);
	return m ? Number(m[1]) : undefined;
};

/* ---------- Google Books ---------- */
const google: Provider = async (isbn13, signal) => {
	const key = env.GOOGLE_BOOKS_API_KEY ? `&key=${env.GOOGLE_BOOKS_API_KEY}` : '';
	const res = await fetch(
		`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}&maxResults=1${key}`,
		{ signal }
	);
	// Without an API key Google shares a small daily quota across many callers and
	// answers 429 often. Set GOOGLE_BOOKS_API_KEY or move it later in ISBN_PROVIDERS.
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = (await res.json()) as {
		items?: { volumeInfo: Record<string, unknown> & { imageLinks?: Record<string, string> } }[];
	};
	const v = json.items?.[0]?.volumeInfo;
	if (!v || typeof v.title !== 'string') return null;
	return {
		isbn13,
		title: v.subtitle ? `${v.title}: ${v.subtitle}` : v.title,
		authors: Array.isArray(v.authors) ? (v.authors as string[]) : [],
		publisher: v.publisher as string | undefined,
		publishedYear: yearOf(v.publishedDate as string | undefined),
		language: v.language as string | undefined,
		pageCount: typeof v.pageCount === 'number' ? v.pageCount : undefined,
		description: v.description as string | undefined,
		coverUrl: v.imageLinks?.thumbnail?.replace(/^http:/, 'https:'),
		source: 'google'
	};
};

/* ---------- Open Library ---------- */
const openlibrary: Provider = async (isbn13, signal) => {
	const res = await fetch(
		`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn13}&format=json&jscmd=data`,
		{ signal, headers: { 'User-Agent': 'leafy-ils (village library)' } }
	);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = (await res.json()) as Record<string, Record<string, unknown>>;
	const d = json[`ISBN:${isbn13}`];
	if (!d || typeof d.title !== 'string') return null;
	const names = (arr: unknown) =>
		Array.isArray(arr) ? arr.map((x) => (x as { name?: string }).name).filter(Boolean) : [];
	return {
		isbn13,
		title: d.subtitle ? `${d.title}: ${d.subtitle}` : d.title,
		authors: names(d.authors) as string[],
		publisher: (names(d.publishers) as string[])[0],
		publishedYear: yearOf(d.publish_date as string | undefined),
		pageCount: typeof d.number_of_pages === 'number' ? d.number_of_pages : undefined,
		coverUrl: (d.cover as { medium?: string } | undefined)?.medium,
		source: 'openlibrary'
	};
};

/* ---------- BnF (Bibliothèque nationale de France) SRU, Dublin Core ---------- */
const decodeXml = (s: string) =>
	s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&')
		.trim();
const dcAll = (xml: string, tag: string) =>
	[...xml.matchAll(new RegExp(`<dc:${tag}[^>]*>([\\s\\S]*?)</dc:${tag}>`, 'g'))].map((m) =>
		decodeXml(m[1])
	);

const bnf: Provider = async (isbn13, signal) => {
	const query = encodeURIComponent(`bib.isbn all "${isbn13}"`);
	const res = await fetch(
		`https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=${query}&recordSchema=dublincore&maximumRecords=1`,
		{ signal }
	);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const xml = await res.text();
	const record = /<srw:record>([\s\S]*?)<\/srw:record>/.exec(xml)?.[1];
	if (!record) return null;
	const title = dcAll(record, 'title')[0];
	if (!title) return null;
	// BnF creators look like "Dupont, Jean (1950-....). Auteur du texte"
	const authors = dcAll(record, 'creator').map((c) => c.replace(/\s*\(.*$/, '').trim());
	return {
		isbn13,
		title: title.replace(/\s*\/.*$/, '').trim(), // drop the "/ author" statement of responsibility
		authors,
		publisher: dcAll(record, 'publisher')[0]?.replace(/^.*?:\s*/, ''),
		publishedYear: yearOf(dcAll(record, 'date')[0]),
		language: dcAll(record, 'language')[0],
		description: dcAll(record, 'description')[0],
		source: 'bnf'
	};
};

const providers: Record<ProviderName, Provider> = { google, openlibrary, bnf };

function providerOrder(): ProviderName[] {
	const raw = env.ISBN_PROVIDERS ?? 'google,openlibrary,bnf';
	return raw
		.split(',')
		.map((s) => s.trim())
		.filter((s): s is ProviderName => s in providers);
}

/** Try each provider in ISBN_PROVIDERS order and return the first hit. */
export async function lookupIsbn(isbn13: string, timeoutMs = 6000): Promise<BookMetadata | null> {
	for (const name of providerOrder()) {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), timeoutMs);
		try {
			const hit = await providers[name](isbn13, ctrl.signal);
			if (hit) return hit;
		} catch (err) {
			console.warn(`[isbn] ${name} failed for ${isbn13}:`, (err as Error).message);
		} finally {
			clearTimeout(timer);
		}
	}
	return null;
}
