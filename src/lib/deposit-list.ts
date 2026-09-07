/**
 * Reading the lender's own list of a deposit, pasted as text. The file comes
 * from their system and its columns vary, so no format is assumed: every line
 * is a book, and every run of digits long enough to be a sticker or an ISBN is
 * a token that may identify it.
 */

export interface ListLine {
	/** The line as pasted, trimmed, for the report. */
	raw: string;
	/** Barcode-looking tokens found on the line, in order. */
	tokens: string[];
}

/** A sticker or ISBN: digits, possibly with a short letter prefix or an ISBN's X check digit. */
const TOKEN = /(?<![\w-])[A-Za-z]{0,3}\d[\d-]{3,}[\dXx]?(?![\w])/g;

/** Lines that carry at least one plausible code. Headers and blank lines drop out. */
export function parseListText(text: string): ListLine[] {
	const lines: ListLine[] = [];
	for (const line of text.split(/\r?\n/)) {
		const raw = line.trim();
		if (!raw) continue;
		const tokens = (raw.match(TOKEN) ?? [])
			.map((t) => t.replace(/-/g, ''))
			.filter((t) => t.replace(/\D/g, '').length >= 4);
		if (tokens.length) lines.push({ raw, tokens });
	}
	return lines;
}
