/**
 * Minimal UNIMARC reader for the XML flavours served by BnF (MarcXchange,
 * `mxc:` prefixed) and Sudoc (plain MARCXML). Regex-based on purpose: the
 * records are small, well-formed, and we only need a handful of fields.
 */

export interface UnimarcField {
	tag: string;
	sub: Record<string, string[]>;
}

const decodeXml = (s: string) =>
	s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/&amp;/g, '&')
		.trim();

export function parseUnimarc(xml: string): UnimarcField[] {
	const fields: UnimarcField[] = [];
	const fieldRe = /<(?:\w+:)?datafield\s+tag="(\d{3})"[^>]*>([\s\S]*?)<\/(?:\w+:)?datafield>/g;
	const subRe = /<(?:\w+:)?subfield\s+code="(\w)">([\s\S]*?)<\/(?:\w+:)?subfield>/g;
	for (const m of xml.matchAll(fieldRe)) {
		const sub: Record<string, string[]> = {};
		for (const s of m[2].matchAll(subRe)) (sub[s[1]] ??= []).push(decodeXml(s[2]));
		fields.push({ tag: m[1], sub });
	}
	return fields;
}

const first = (fields: UnimarcField[], tag: string, code: string) =>
	fields.find((f) => f.tag === tag && f.sub[code]?.length)?.sub[code][0];

/** ISO 639-2 (bibliographic) → ISO 639-1 for the languages a French library meets. */
const LANG_3_TO_2: Record<string, string> = {
	fre: 'fr',
	fra: 'fr',
	eng: 'en',
	ger: 'de',
	deu: 'de',
	spa: 'es',
	ita: 'it',
	por: 'pt',
	dut: 'nl',
	nld: 'nl',
	jpn: 'ja',
	cat: 'ca',
	oci: 'oc',
	bre: 'br',
	ara: 'ar',
	rus: 'ru',
	pol: 'pl',
	swe: 'sv',
	dan: 'da',
	nor: 'no',
	fin: 'fi',
	tur: 'tr',
	chi: 'zh',
	zho: 'zh',
	kor: 'ko',
	lat: 'la',
	grc: 'el',
	gre: 'el',
	ell: 'el',
	mul: 'mul'
};

export interface UnimarcBook {
	title: string;
	authors: string[];
	publisher?: string;
	publishedYear?: number;
	language?: string;
	pageCount?: number;
	description?: string;
	isbn?: string;
	/** BnF ARK, from the record id or from Sudoc's 033 link to BnF. */
	bnfArk?: string;
}

const cleanPublisher = (s: string) =>
	s
		.replace(/[[\]]/g, '')
		.replace(/\s*:\s*$/, '')
		.trim();

/** Turn a UNIMARC record into the fields the catalogue cares about. */
export function unimarcToBook(fields: UnimarcField[]): UnimarcBook | null {
	const title = first(fields, '200', 'a');
	if (!title) return null;

	const parts = [title];
	const sub = first(fields, '200', 'e');
	if (sub) parts.push(`: ${sub}`);
	const partNo = first(fields, '200', 'h');
	if (partNo) parts.push(`. ${partNo}`);
	const partTitle = first(fields, '200', 'i');
	if (partTitle) parts.push(`, ${partTitle}`);

	// 700/701 = main and co-authors as "Surname $a, Forename $b"; 200$f is the free-text statement.
	const authors = fields
		.filter((f) => f.tag === '700' || f.tag === '701')
		.map((f) => [f.sub.b?.[0], f.sub.a?.[0]].filter(Boolean).join(' ').trim())
		.filter(Boolean);
	if (authors.length === 0) {
		const statement = first(fields, '200', 'f');
		if (statement)
			authors.push(
				...statement
					.split(/\s*[,;]\s*|\s+et\s+/)
					.map((s) => s.trim())
					.filter(Boolean)
			);
	}

	// 210 is the classic publication field, 214 its newer replacement. Take the first with a publisher.
	const pub = fields.find((f) => (f.tag === '210' || f.tag === '214') && f.sub.c?.length);
	const date = fields.find((f) => (f.tag === '210' || f.tag === '214') && f.sub.d?.length)?.sub
		.d[0];
	const year = date && /(\d{4})/.exec(date)?.[1];

	const extent = first(fields, '215', 'a'); // "1 vol. (113 p.)"
	const pages = extent && /(\d+)\]?\s*p\b/.exec(extent)?.[1]; // "113 p." or "[30] p."

	const lang = first(fields, '101', 'a');
	const isbnRaw = first(fields, '010', 'a');
	const arkLink = fields.find((f) => f.tag === '033' && /ark:\/12148\//.test(f.sub.a?.[0] ?? ''))
		?.sub.a?.[0];

	return {
		title: parts.join(''),
		authors: [...new Set(authors)],
		publisher: pub ? cleanPublisher(pub.sub.c![0]) : undefined,
		publishedYear: year ? Number(year) : undefined,
		language: lang ? (LANG_3_TO_2[lang] ?? lang) : undefined,
		pageCount: pages ? Number(pages) : undefined,
		description: first(fields, '330', 'a'),
		isbn: isbnRaw?.replace(/[^0-9Xx]/g, ''),
		bnfArk: arkLink && /ark:\/12148\/\w+/.exec(arkLink)?.[0]
	};
}
