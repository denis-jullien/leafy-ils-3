/**
 * Loose text matching for the catalogue: what people type at the search box
 * rarely matches the record letter for letter. "dgray" should find "D.Gray-man",
 * "pere noel" should find "Père Noël", and "grey" should still find "Gray".
 */

/** Lowercase, no accents, letters and digits only: "D.Gray-man" → "dgrayman". */
export function squash(s: string): string {
	return s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/œ/g, 'oe')
		.replace(/æ/g, 'ae')
		.replace(/ß/g, 'ss')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '');
}

/** The squashed words of a text, in order: "D.Gray-man, tome 1" → ["dgrayman", "tome", "1"]. */
export function squashedWords(s: string): string[] {
	return s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.split(/[^a-z0-9œæß]+/)
		.map(squash)
		.filter(Boolean);
}

/** Edit distance counting a swap of two neighbours as one change (optimal string alignment). */
export function editDistance(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	if (!m) return n;
	if (!n) return m;
	let prev2: number[] = [];
	let prev = Array.from({ length: n + 1 }, (_, j) => j);
	for (let i = 1; i <= m; i++) {
		const cur = [i];
		for (let j = 1; j <= n; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
				d = Math.min(d, prev2[j - 2] + 1);
			cur.push(d);
		}
		prev2 = prev;
		prev = cur;
	}
	return prev[n];
}

/** 1 for identical strings, 0 for nothing in common. */
export const similarity = (a: string, b: string) =>
	a.length || b.length ? 1 - editDistance(a, b) / Math.max(a.length, b.length) : 1;

/** Below this a fuzzy hit is noise: one typo in a four-letter word is 0.75. */
export const FUZZY_THRESHOLD = 0.75;
/** Words shorter than this are not compared on their own. */
const MIN_FUZZY_WORD = 4;

/**
 * How close a query comes to a text, typos allowed: the best of the whole text,
 * each word, and each run of neighbouring words as long as the query.
 * "grey" against "D.Gray-man" is 0.75 (gray); "harry poter" against
 * "Harry Potter à l'école des sorciers" is 0.91 (harrypotter).
 */
export function fuzzyScore(query: string, text: string): number {
	const q = squash(query);
	if (!q) return 0;
	const words = squashedWords(text);
	const span = Math.max(1, squashedWords(query).length);
	let best = similarity(q, squash(text));
	for (let i = 0; i < words.length; i++) {
		// Articles and initials ("une", "d") are one edit from too many things.
		if (words[i].length >= MIN_FUZZY_WORD) best = Math.max(best, similarity(q, words[i]));
		if (span > 1 && i + span <= words.length)
			best = Math.max(best, similarity(q, words.slice(i, i + span).join('')));
	}
	return best;
}
