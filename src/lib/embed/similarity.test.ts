import { describe, expect, it } from 'vitest';
import {
	bookText,
	bookTexts,
	combine,
	confidenceFromMargin,
	describesItself,
	rankShelves,
	shelfText
} from './similarity';

describe('embedding helpers', () => {
	it('builds shelf text from the description, or from human keywords', () => {
		expect(
			shelfText({ id: 1, name: 'Polars', description: 'Romans policiers.', keywords: 'polar' })
		).toBe('passage: Polars. Romans policiers.');
		expect(
			shelfText({
				id: 2,
				name: 'Jeunesse',
				description: null,
				keywords: 'public:jeunesse, albums, contes'
			})
		).toBe('passage: Jeunesse. albums, contes');
	});

	it('only considers shelves with a real description', () => {
		expect(
			describesItself({
				id: 1,
				name: 'Ados',
				description: null,
				keywords: 'public:ado, adolescents'
			})
		).toBe(false);
		expect(
			describesItself({
				id: 2,
				name: 'Polars',
				description: 'Romans policiers, thrillers et enquêtes.',
				keywords: null
			})
		).toBe(true);
	});

	it('builds the core text without coded signals', () => {
		const [core] = bookTexts({
			title: 'Dune',
			authors: ['Frank Herbert'],
			subjects: ['Science-fiction', 'public:adulte']
		});
		expect(core.text).toBe('query: Dune. Frank Herbert. Sujets : Science-fiction');
		expect(core.weight).toBe(1);
		expect(bookText({ title: 'Dune' })).toBe('query: Dune');
	});

	it('splits the blurb from the headings and weights the headings more', () => {
		const parts = bookTexts({
			title: 'Astérix',
			subjects: ['Bandes dessinées'],
			description: 'Nous sommes en 50 avant J.-C.'
		});
		expect(parts.map((p) => p.weight)).toEqual([0.65, 0.35]);
		expect(parts[0].text).toContain('Sujets : Bandes dessinées');
		expect(parts[1].text).toContain('Nous sommes en 50');
		expect(
			combine(
				[
					[1, 0],
					[0, 1]
				],
				[0.65, 0.35]
			)
		).toEqual([0.65, 0.35]);
	});

	it('ranks by the best of description and examples, with a margin', () => {
		const book = [1, 0];
		const shelves = [
			{ shelfId: 1, vector: [0.7, 0.7] },
			{ shelfId: 2, vector: [0, 1] }
		];
		const examples = [{ shelfId: 2, vector: [0.99, 0.1] }];
		const p = rankShelves(book, shelves, examples)!;
		expect(p.shelfId).toBe(2);
		expect(p.via).toBe('example');
		expect(p.runnerUp).toBe(1);
		expect(p.margin).toBeCloseTo(0.99 - 0.7, 2);
		expect(p.confidence).toBe('sure');
		expect(confidenceFromMargin(0.015)).toBe('likely');
		expect(confidenceFromMargin(0.001)).toBe('unsure');
	});
});
