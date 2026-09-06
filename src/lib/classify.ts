/**
 * Propose a shelf for a book from what the catalogues say about it.
 *
 * Each shelf carries two rules, edited by the volunteers:
 *  - keywords: comma-separated words or phrases, matched whole-word and
 *    accent-insensitively against subject headings, genre headings, catalogue
 *    categories and the synthetic signals below;
 *  - dewey: comma-separated prefixes ("741.5") or ranges ("800-899") matched
 *    against the record's class number.
 * Shelves are tried in order; the first match wins.
 *
 * Synthetic signals derived from coded fields, usable as keywords:
 *   public:jeunesse  public:ado  public:adulte
 *   forme:roman  forme:nouvelles  forme:fiction  forme:poesie  forme:theatre  forme:documentaire
 */

export interface ShelfRules {
	id: number;
	name: string;
	keywords: string | null;
	dewey: string | null;
}

export interface ClassifySignals {
	/** Subject and genre headings, catalogue categories, plus synthetic tokens. */
	subjects: string[];
	/** Dewey or Dewey-like class numbers ("843.914", "741.5", "809"). */
	dewey: string[];
}

export interface ShelfMatch {
	shelf: ShelfRules;
	/** Human explanation, e.g. « mot-clé "albums" » or « Dewey 741.5 ». */
	reason: string;
}

/** Lowercase, strip accents, keep letters, digits, ':' and spaces. */
export function normalize(s: string): string {
	return s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9:]+/g, ' ')
		.trim();
}

export const splitList = (s: string | null | undefined) =>
	(s ?? '')
		.split(',')
		.map((k) => k.trim())
		.filter(Boolean);

function keywordHits(keyword: string, subjects: string[]): string | null {
	const k = normalize(keyword);
	if (!k) return null;
	for (const subject of subjects) {
		const text = ` ${normalize(subject)} `;
		if (text.includes(` ${k} `)) return subject;
	}
	return null;
}

/** "741.5" is a prefix rule; "800-899" a range on the integer class. */
function deweyHits(rule: string, numbers: string[]): string | null {
	const r = rule.trim();
	const range = /^(\d{1,3})\s*-\s*(\d{1,3})$/.exec(r);
	for (const n of numbers) {
		const num = n.trim();
		if (!num) continue;
		if (range) {
			const cls = Math.floor(parseFloat(num));
			if (!Number.isNaN(cls) && cls >= Number(range[1]) && cls <= Number(range[2])) return num;
		} else if (num.startsWith(r)) return num;
	}
	return null;
}

export function suggestShelf(shelves: ShelfRules[], signals: ClassifySignals): ShelfMatch | null {
	for (const shelf of shelves) {
		for (const kw of splitList(shelf.keywords)) {
			const hit = keywordHits(kw, signals.subjects);
			if (hit)
				return {
					shelf,
					reason:
						normalize(hit) === normalize(kw)
							? `mot-clé « ${kw} »`
							: `mot-clé « ${kw} » dans « ${hit} »`
				};
		}
		for (const rule of splitList(shelf.dewey)) {
			const hit = deweyHits(rule, signals.dewey);
			if (hit) return { shelf, reason: `Dewey ${hit}` };
		}
	}
	return null;
}

/* ---- UNIMARC coded fields → synthetic signals ---- */

/** 100$a positions 17-19: target audience. */
export function audienceSignals(field100a: string | undefined): string[] {
	if (!field100a || field100a.length < 20) return [];
	const codes = field100a.slice(17, 20);
	const out = new Set<string>();
	for (const c of codes) {
		if ('abcd'.includes(c)) out.add('public:jeunesse');
		else if (c === 'e') out.add('public:ado');
		else if ('km'.includes(c)) out.add('public:adulte');
	}
	return [...out];
}

/** 105$a position 11: literary form. */
export function formSignals(field105a: string | undefined): string[] {
	const c = field105a?.[11];
	switch (c) {
		case 'a':
			return ['forme:roman', 'forme:fiction'];
		case 'f':
			return ['forme:nouvelles', 'forme:fiction'];
		case 'b':
			return ['forme:theatre'];
		case 'g':
			return ['forme:poesie'];
		case 'y':
			return ['forme:documentaire'];
		default:
			return [];
	}
}
