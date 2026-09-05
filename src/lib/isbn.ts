/**
 * ISBN helpers. Everything stored in the database is an ISBN-13 without
 * separators; these functions turn whatever a human or a scanner produced
 * into that form, or reject it.
 */

/** Strip hyphens, spaces and an "ISBN" prefix. Uppercases a trailing x. */
export function cleanIsbn(input: string): string {
	return input
		.trim()
		.replace(/^isbn[-:\s]*/i, '')
		.replace(/[\s-]/g, '')
		.toUpperCase();
}

export function isValidIsbn10(isbn: string): boolean {
	if (!/^\d{9}[\dX]$/.test(isbn)) return false;
	let sum = 0;
	for (let i = 0; i < 10; i++) {
		const c = isbn[i];
		const v = c === 'X' ? 10 : Number(c);
		sum += v * (10 - i);
	}
	return sum % 11 === 0;
}

export function isbn13CheckDigit(first12: string): string {
	let sum = 0;
	for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
	return String((10 - (sum % 10)) % 10);
}

export function isValidIsbn13(isbn: string): boolean {
	if (!/^\d{13}$/.test(isbn)) return false;
	return isbn13CheckDigit(isbn.slice(0, 12)) === isbn[12];
}

export function isbn10To13(isbn10: string): string {
	const first12 = '978' + isbn10.slice(0, 9);
	return first12 + isbn13CheckDigit(first12);
}

/**
 * Parse free-form input (typed, scanned, pasted) into a canonical ISBN-13.
 * Accepts ISBN-10, ISBN-13, and an EAN-13 followed by a 5-digit price add-on
 * (some scanners emit both). Returns null when it is not an ISBN.
 */
export function parseIsbn(input: string): string | null {
	const s = cleanIsbn(input);
	if (isValidIsbn13(s)) return s;
	if (isValidIsbn10(s)) return isbn10To13(s);
	if (/^\d{18}$/.test(s) && isValidIsbn13(s.slice(0, 13))) return s.slice(0, 13);
	return null;
}

/** True for a 13-digit code in the Bookland range (978/979) with a valid checksum. */
export function looksLikeIsbn13(code: string): boolean {
	return /^97[89]\d{10}$/.test(code) && isValidIsbn13(code);
}

/** 978-2-07-036822-8 style display. Grouping is approximate; storage stays unhyphenated. */
export function formatIsbn13(isbn: string): string {
	if (!isValidIsbn13(isbn)) return isbn;
	return `${isbn.slice(0, 3)}-${isbn.slice(3, 4)}-${isbn.slice(4, 9)}-${isbn.slice(9, 12)}-${isbn.slice(12)}`;
}

/**
 * Language guessed from the ISBN registration group. Only the groups a French
 * village library is likely to meet; anything else returns undefined.
 */
export function languageFromIsbn(isbn13: string): string | undefined {
	if (!isValidIsbn13(isbn13)) return undefined;
	const body = isbn13.slice(3);
	const groups: [string, string][] = [
		['0', 'en'],
		['1', 'en'],
		['2', 'fr'],
		['3', 'de'],
		['4', 'ja'],
		['5', 'ru'],
		['7', 'zh'],
		['80', 'cs'],
		['81', 'hi'],
		['82', 'no'],
		['83', 'pl'],
		['84', 'es'],
		['85', 'pt'],
		['86', 'sr'],
		['87', 'da'],
		['88', 'it'],
		['89', 'ko'],
		['90', 'nl'],
		['91', 'sv'],
		['92', 'mul'],
		['93', 'hi'],
		['94', 'nl'],
		['950', 'es'],
		['951', 'fi'],
		['952', 'fi'],
		['953', 'hr'],
		['956', 'es'],
		['958', 'es'],
		['960', 'el'],
		['962', 'zh'],
		['963', 'hu'],
		['965', 'he'],
		['966', 'uk'],
		['970', 'es'],
		['972', 'pt'],
		['973', 'ro'],
		['975', 'tr'],
		['978', 'en'],
		['979', 'id'],
		['980', 'es'],
		['987', 'es'],
		['9910', 'fr'],
		['9911', 'fr'],
		['9912', 'fr']
	];
	if (isbn13.startsWith('979')) {
		// 979-10/11/12 are France; 979-8 is the US.
		if (body.startsWith('10') || body.startsWith('11') || body.startsWith('12')) return 'fr';
		if (body.startsWith('8')) return 'en';
		return undefined;
	}
	const hit = groups.find(([g]) => body.startsWith(g));
	return hit?.[1];
}
