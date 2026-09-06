/**
 * Inventaire.io entities (https://api.inventaire.io, "Entities"): the parsing half
 * of the provider, kept free of network and env so it can be tested on a fixture.
 * Claims use Wikidata properties: P1476 title, P1680 subtitle, P577 publication
 * date, P1104 pages, P407 language, P629 work, P50 author, P123 publisher,
 * P136 genre, P921 main subject, P268 BnF record id.
 */
export interface InvEntity {
	type?: string;
	labels?: Record<string, string>;
	descriptions?: Record<string, string>;
	claims?: Record<string, unknown[]>;
	image?: { url?: string };
}

export interface InvRecord {
	title: string;
	authors: string[];
	publisher?: string;
	publishedYear?: number;
	language?: string;
	pageCount?: number;
	subjects?: string[];
	covers?: { url: string; source: string }[];
	bnfArk?: string;
}

/** Wikidata ids of the languages a village library is likely to meet. */
const WD_LANG: Record<string, string> = {
	'wd:Q150': 'fr',
	'wd:Q1860': 'en',
	'wd:Q188': 'de',
	'wd:Q1321': 'es',
	'wd:Q652': 'it',
	'wd:Q5146': 'pt',
	'wd:Q7411': 'nl',
	'wd:Q7026': 'ca',
	'wd:Q14185': 'oc',
	'wd:Q13955': 'ar',
	'wd:Q5287': 'ja',
	'wd:Q7737': 'ru'
};

export const invLabel = (e?: InvEntity) =>
	e?.labels?.fr ?? e?.labels?.en ?? Object.values(e?.labels ?? {})[0];

const yearOf = (s?: string) => {
	const m = s && /(\d{4})/.exec(s);
	return m ? Number(m[1]) : undefined;
};

/**
 * Reads the edition out of a `by-uris` answer fetched with
 * `relatives=wdt:P50|wdt:P629|wdt:P123`. Returns the record and the Wikidata ids
 * of genres and subjects still to be resolved to labels.
 */
export function parseInventaire(
	ents: Record<string, InvEntity>
): { record: InvRecord; labelIds: string[] } | null {
	const edition = Object.values(ents).find((e) => e.type === 'edition');
	if (!edition) return null;
	const values = (e: InvEntity | undefined, prop: string) =>
		(e?.claims?.[prop] ?? []).filter((v): v is string => typeof v === 'string');
	const first = (e: InvEntity | undefined, prop: string) => values(e, prop)[0];
	const related = (e: InvEntity | undefined, prop: string) =>
		values(e, prop)
			.map((id) => ents[id])
			.filter((x): x is InvEntity => !!x);

	const works = related(edition, 'wdt:P629');
	const title =
		first(edition, 'wdt:P1476') ?? edition.labels?.fromclaims ?? works.map(invLabel).find(Boolean);
	if (!title) return null;
	const subtitle = first(edition, 'wdt:P1680');
	const authors = [...new Set(works.flatMap((w) => related(w, 'wdt:P50').map(invLabel)))].filter(
		(a): a is string => !!a
	);
	const pages = (edition.claims?.['wdt:P1104'] ?? [])[0];
	const bnfId = first(edition, 'wdt:P268');
	const image = edition.image?.url;

	// Wikidata's one-line description of the work ("roman d'Antoine de Saint-Exupéry
	// (1943)") names the form of the book: a useful signal, not a blurb.
	const subjects = works.map((w) => w.descriptions?.fr).filter((d): d is string => !!d);
	const labelIds = [
		...new Set(works.flatMap((w) => [...values(w, 'wdt:P136'), ...values(w, 'wdt:P921')]))
	];

	return {
		record: {
			title: subtitle ? `${title}: ${subtitle}` : title,
			authors,
			publisher: related(edition, 'wdt:P123').map(invLabel).find(Boolean),
			publishedYear: yearOf(first(edition, 'wdt:P577')),
			language: WD_LANG[first(edition, 'wdt:P407') ?? ''],
			pageCount: typeof pages === 'number' ? pages : undefined,
			subjects,
			bnfArk: bnfId ? `ark:/12148/cb${bnfId}` : undefined,
			covers: image
				? [
						{
							url: image.startsWith('http') ? image : `https://inventaire.io${image}`,
							source: 'inventaire'
						}
					]
				: []
		},
		labelIds
	};
}
