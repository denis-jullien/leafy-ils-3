/**
 * Pure helpers for the optional local embedding classifier. The model runs in
 * the browser; this file only builds the texts and compares vectors.
 */

export interface ShelfForEmbedding {
	id: number;
	name: string;
	description: string | null;
	keywords: string | null;
}

export interface BookForEmbedding {
	title: string;
	authors?: string | string[] | null;
	publisher?: string | null;
	description?: string | null;
	subjects?: string[] | null;
}

/** e5 models expect these prefixes; the shelf side is the "passage". */
export const QUERY_PREFIX = 'query: ';
export const PASSAGE_PREFIX = 'passage: ';

/** Keywords minus the coded signals (public:jeunesse…), which mean nothing to a language model. */
const humanKeywords = (keywords: string | null) =>
	(keywords ?? '')
		.split(',')
		.map((k) => k.trim())
		.filter((k) => k && !k.includes(':'))
		.join(', ');

/** Below this, a shelf text is too short to embed meaningfully: it would match anything. */
export const MIN_SHELF_TEXT = 30;

/** True when the shelf has enough description or human keywords to compare against. */
export const describesItself = (shelf: ShelfForEmbedding) =>
	(shelf.description?.trim() || humanKeywords(shelf.keywords)).length >= MIN_SHELF_TEXT;

export function shelfText(shelf: ShelfForEmbedding): string {
	const body = shelf.description?.trim() || humanKeywords(shelf.keywords);
	return `${PASSAGE_PREFIX}${shelf.name}. ${body}`.trim();
}

/**
 * A book becomes up to two texts: what the catalogues say it *is* (title,
 * authors, subject and genre headings) and, separately, its blurb. The blurb
 * reads like the story and would otherwise drown the headings, so it gets the
 * smaller weight when the two are combined.
 */
export interface WeightedText {
	text: string;
	weight: number;
}

const CORE_WEIGHT = 0.65;
const BLURB_WEIGHT = 0.35;

export function bookTexts(book: BookForEmbedding): WeightedText[] {
	const authors = Array.isArray(book.authors) ? book.authors.join(', ') : (book.authors ?? '');
	const subjects = (book.subjects ?? []).filter((s) => !s.includes(':')).slice(0, 12);
	const core = [book.title, authors, subjects.length ? `Sujets : ${subjects.join(', ')}` : '']
		.filter(Boolean)
		.join('. ');
	const blurb = book.description?.trim().slice(0, 400) ?? '';
	if (!blurb) return [{ text: `${QUERY_PREFIX}${core}`, weight: 1 }];
	return [
		{ text: `${QUERY_PREFIX}${core}`, weight: CORE_WEIGHT },
		{ text: `${QUERY_PREFIX}${book.title}. ${blurb}`, weight: BLURB_WEIGHT }
	];
}

/** Single-text form, kept for callers that only need one string. */
export const bookText = (book: BookForEmbedding) => bookTexts(book)[0].text;

/** Weighted sum of unit vectors. Cosine is linear, so ranking uses the same weights. */
export function combine(vectors: number[][], weights: number[]): number[] {
	const out = new Array<number>(vectors[0].length).fill(0);
	vectors.forEach((v, i) => v.forEach((x, j) => (out[j] += weights[i] * x)));
	return out;
}

export function cosine(a: number[], b: number[]): number {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i] * b[i];
	return s;
}

export type Confidence = 'sure' | 'likely' | 'unsure';

export interface Ranked {
	shelfId: number;
	score: number;
	/** What the score is closest to: the shelf description or a shelved book. */
	via: 'description' | 'example';
}

export interface Proposal {
	shelfId: number;
	score: number;
	/** Gap to the runner-up. e5 scores are compressed, so this is the useful signal. */
	margin: number;
	confidence: Confidence;
	via: Ranked['via'];
	runnerUp: number | null;
}

export const confidenceFromMargin = (margin: number): Confidence =>
	margin >= 0.03 ? 'sure' : margin >= 0.01 ? 'likely' : 'unsure';

/**
 * Score each shelf as the best of: similarity to its description, similarity to
 * the closest book already on that shelf. Returns the best shelf with its margin.
 */
export function rankShelves(
	book: number[],
	shelfVectors: { shelfId: number; vector: number[] }[],
	exampleVectors: { shelfId: number; vector: number[] }[] = []
): Proposal | null {
	const best = new Map<number, Ranked>();
	for (const s of shelfVectors)
		best.set(s.shelfId, { shelfId: s.shelfId, score: cosine(book, s.vector), via: 'description' });
	for (const e of exampleVectors) {
		const score = cosine(book, e.vector);
		const cur = best.get(e.shelfId);
		if (!cur || score > cur.score)
			best.set(e.shelfId, { shelfId: e.shelfId, score, via: 'example' });
	}
	const ranked = [...best.values()].sort((a, b) => b.score - a.score);
	if (ranked.length === 0) return null;
	const margin = ranked.length > 1 ? ranked[0].score - ranked[1].score : 1;
	return {
		shelfId: ranked[0].shelfId,
		score: ranked[0].score,
		margin,
		confidence: confidenceFromMargin(margin),
		via: ranked[0].via,
		runnerUp: ranked[1]?.shelfId ?? null
	};
}
