import { describe, expect, it } from 'vitest';
import { parseInventaire, type InvEntity } from './inventaire';
import fixture from './fixtures/inventaire-petit-prince.json';

const ents = fixture.entities as Record<string, InvEntity>;

describe('parseInventaire', () => {
	it('reads the edition, its work, author and publisher from one by-uris answer', () => {
		const parsed = parseInventaire(ents)!;
		expect(parsed.record).toMatchObject({
			title: 'Le Petit Prince',
			authors: ['Antoine de Saint-Exupéry'],
			publisher: 'Éditions Gallimard',
			publishedYear: 2007,
			language: 'fr',
			pageCount: 120,
			bnfArk: 'ark:/12148/cb41023439w'
		});
		expect(parsed.record.covers).toEqual([
			{
				url: 'https://inventaire.io/img/entities/ddaa92b1684f7ec459b8073da337423f51235c0d',
				source: 'inventaire'
			}
		]);
	});

	it("keeps the work's description as a signal and lists the genre ids to resolve", () => {
		const parsed = parseInventaire(ents)!;
		expect(parsed.record.subjects).toEqual(["roman d'Antoine de Saint-Exupéry (1943)"]);
		expect(parsed.labelIds).toContain('wd:Q17991521');
		expect(parsed.labelIds.every((id) => id.startsWith('wd:'))).toBe(true);
	});

	it('counts the scenarist and the artists of a comic as its authors', () => {
		const comic: Record<string, InvEntity> = {
			'inv:ed': {
				type: 'edition',
				labels: { fromclaims: 'Perché' },
				claims: { 'wdt:P1476': ['Perché'], 'wdt:P629': ['inv:wk'], 'wdt:P577': ['2022'] }
			},
			'inv:wk': {
				type: 'work',
				labels: { fr: 'Perché' },
				claims: { 'wdt:P58': ['inv:a', 'inv:b'], 'wdt:P10837': ['inv:c'], 'wdt:P6338': ['inv:c'] }
			},
			'inv:a': { type: 'human', labels: { fr: 'Noël Chanat' } },
			'inv:b': { type: 'human', labels: { fr: 'Kévin Mantovani' } },
			'inv:c': { type: 'human', labels: { fr: 'Remingo' } }
		};
		expect(parseInventaire(comic)!.record.authors).toEqual([
			'Noël Chanat',
			'Kévin Mantovani',
			'Remingo'
		]);
	});

	it('answers null when Inventaire has no edition', () => {
		expect(parseInventaire({})).toBeNull();
		expect(parseInventaire({ 'wd:Q1': { type: 'work', labels: { fr: 'X' } } })).toBeNull();
	});
});
