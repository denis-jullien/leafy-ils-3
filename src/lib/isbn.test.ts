import { describe, expect, it } from 'vitest';
import {
	cleanIsbn,
	isValidIsbn10,
	isValidIsbn13,
	isbn10To13,
	parseIsbn,
	looksLikeIsbn13
} from './isbn';

describe('isbn', () => {
	it('cleans separators and prefixes', () => {
		expect(cleanIsbn(' ISBN 978-2-07-036822-8 ')).toBe('9782070368228');
		expect(cleanIsbn('2-07-036822-x')).toBe('207036822X');
	});

	it('validates ISBN-10', () => {
		expect(isValidIsbn10('207036822X')).toBe(true);
		expect(isValidIsbn10('080442957X')).toBe(true);
		expect(isValidIsbn10('2070368224')).toBe(false);
	});

	it('validates ISBN-13', () => {
		expect(isValidIsbn13('9782070368228')).toBe(true);
		expect(isValidIsbn13('9780306406157')).toBe(true);
		expect(isValidIsbn13('9780306406158')).toBe(false);
	});

	it('converts ISBN-10 to ISBN-13', () => {
		expect(isbn10To13('207036822X')).toBe('9782070368228');
		expect(isbn10To13('0306406152')).toBe('9780306406157');
	});

	it('parses whatever a scanner or a human produces', () => {
		expect(parseIsbn('978-2-07-036822-8')).toBe('9782070368228');
		expect(parseIsbn('2-07-036822-x')).toBe('9782070368228');
		expect(parseIsbn('978207036822890000')).toBe('9782070368228'); // EAN-13 + EAN-5 add-on
		expect(parseIsbn('F000042')).toBeNull();
		expect(parseIsbn('')).toBeNull();
	});

	it('recognises Bookland EANs', () => {
		expect(looksLikeIsbn13('9782070368228')).toBe(true);
		expect(looksLikeIsbn13('3000000000000')).toBe(false);
	});
});
