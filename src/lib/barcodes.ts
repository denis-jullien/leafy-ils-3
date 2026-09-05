/**
 * Barcode conventions. Everything the volunteer scans lands in one input, so
 * the prefix is what tells a family card from a book label.
 *
 *  - Books with an ISBN use the ISBN-13 printed by the publisher (EAN-13).
 *  - Books without one get an internal label: B + 6 digits.
 *  - Family cards: F + 6 digits.
 *  - RFID tags carry a hex UID; we match those on the rfid_uid column.
 */
export const FAMILY_PREFIX = 'F';
export const BOOK_PREFIX = 'B';

export function familyBarcode(id: number): string {
	return FAMILY_PREFIX + String(id).padStart(6, '0');
}

export function bookBarcode(id: number): string {
	return BOOK_PREFIX + String(id).padStart(6, '0');
}

export function parseFamilyBarcode(code: string): number | null {
	const m = /^F(\d{6,})$/i.exec(code.trim());
	return m ? Number(m[1]) : null;
}

export function parseBookBarcode(code: string): number | null {
	const m = /^B(\d{6,})$/i.exec(code.trim());
	return m ? Number(m[1]) : null;
}

/** RFID readers usually emit the tag UID as hex, sometimes with colons or spaces. */
export function normalizeRfidUid(raw: string): string {
	return raw.replace(/[^0-9a-f]/gi, '').toUpperCase();
}
