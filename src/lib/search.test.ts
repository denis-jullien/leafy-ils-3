import { describe, expect, it } from 'vitest';
import { editDistance, fuzzyScore, similarity, squash, squashedWords } from './search';

describe('search helpers', () => {
	it('squashes case, accents, punctuation and spaces', () => {
		expect(squash('D.Gray-man')).toBe('dgrayman');
		expect(squash('d. gray')).toBe('dgray');
		expect(squash('Père Noël')).toBe('perenoel');
		expect(squash("Cœur d'encre")).toBe('coeurdencre');
		expect(squashedWords('D.Gray-man, tome 1')).toEqual(['d', 'gray', 'man', 'tome', '1']);
	});

	it('counts a swapped pair as one edit', () => {
		expect(editDistance('gray', 'grey')).toBe(1);
		expect(editDistance('potter', 'ptoter')).toBe(1);
		expect(editDistance('', 'abc')).toBe(3);
		expect(similarity('gray', 'grey')).toBeCloseTo(0.75);
	});

	it('scores a query against the closest word or run of words', () => {
		expect(fuzzyScore('grey', 'D.Gray-man')).toBeCloseTo(0.75);
		expect(fuzzyScore('harry poter', "Harry Potter à l'école des sorciers")).toBeGreaterThan(0.9);
		expect(fuzzyScore('chevalié', 'Tracy Chevalier')).toBeGreaterThan(0.85);
		expect(fuzzyScore('zzzz', 'Le petit prince')).toBeLessThan(0.5);
		// "une" alone is not a hit for "dune".
		expect(fuzzyScore('dune', 'Le Père Noël est une ordure')).toBeLessThan(0.75);
	});
});
