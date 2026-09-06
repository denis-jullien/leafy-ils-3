import { describe, expect, it } from 'vitest';
import { audienceSignals, formSignals, normalize, suggestShelf, type ShelfRules } from './classify';

const shelves: ShelfRules[] = [
	{ id: 1, name: 'Jeunesse', keywords: 'public:jeunesse, jeunesse, albums, enfants', dewey: null },
	{
		id: 2,
		name: 'BD & Mangas',
		keywords: 'bande dessinée, bandes dessinées, manga',
		dewey: '741.5'
	},
	{
		id: 3,
		name: 'Polars',
		keywords: 'roman policier, romans policiers, polar, thriller',
		dewey: null
	},
	{ id: 4, name: 'Romans', keywords: 'roman, romans, forme:roman', dewey: '800-899' },
	{ id: 5, name: 'Documentaires', keywords: 'forme:documentaire', dewey: '000-799, 900-999' }
];

describe('classify', () => {
	it('normalizes accents, case and punctuation', () => {
		expect(normalize("Livres d'images pour la Jeunesse !")).toBe(
			'livres d images pour la jeunesse'
		);
		expect(normalize('Bandes dessinées')).toBe('bandes dessinees');
	});

	it('matches whole words only, first shelf wins', () => {
		// "polaire" must not match "polar"
		expect(
			suggestShelf(shelves, { subjects: ['Régions polaires'], dewey: ['919.8'] })?.shelf.name
		).toBe('Documentaires');
		expect(suggestShelf(shelves, { subjects: ['Roman policier'], dewey: [] })?.shelf.name).toBe(
			'Polars'
		);
		// a children's detective story is shelved with children
		expect(
			suggestShelf(shelves, { subjects: ['Roman policier', 'public:jeunesse'], dewey: [] })?.shelf
				.name
		).toBe('Jeunesse');
	});

	it('matches dewey prefixes and ranges', () => {
		expect(suggestShelf(shelves, { subjects: [], dewey: ['741.5944'] })?.shelf.name).toBe(
			'BD & Mangas'
		);
		expect(suggestShelf(shelves, { subjects: [], dewey: ['843.914'] })?.shelf.name).toBe('Romans');
		expect(suggestShelf(shelves, { subjects: [], dewey: ['635'] })?.shelf.name).toBe(
			'Documentaires'
		);
		expect(suggestShelf(shelves, { subjects: [], dewey: [] })).toBeNull();
	});

	it('explains the match', () => {
		const m = suggestShelf(shelves, { subjects: ['Albums jeunesse'], dewey: [] })!;
		expect(m.reason).toContain('Albums jeunesse');
	});

	it('reads audience and literary form from UNIMARC coded fields', () => {
		expect(audienceSignals('20140418d2014    a  y0frey50      ba')).toEqual(['public:jeunesse']);
		expect(audienceSignals('20070830h20072007m  y0frey50      ba')).toEqual(['public:adulte']);
		expect(formSignals('||||z   00|a|')).toEqual(['forme:roman', 'forme:fiction']);
		expect(formSignals('||||z   00|y|')).toEqual(['forme:documentaire']);
		expect(formSignals(undefined)).toEqual([]);
	});
});
