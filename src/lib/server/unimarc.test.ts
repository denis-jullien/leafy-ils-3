import { describe, expect, it } from 'vitest';
import { parseUnimarc, unimarcToBook } from './unimarc';

const bnf = `<srw:record><srw:recordData><mxc:record>
<mxc:datafield tag="010" ind1=" " ind2=" "><mxc:subfield code="a">978-2-07-061275-8</mxc:subfield><mxc:subfield code="b">br.</mxc:subfield></mxc:datafield>
<mxc:datafield tag="101" ind1="0" ind2=" "><mxc:subfield code="a">fre</mxc:subfield></mxc:datafield>
<mxc:datafield tag="200" ind1="1" ind2=" "><mxc:subfield code="a">Le petit prince</mxc:subfield><mxc:subfield code="b">Texte imprimé</mxc:subfield><mxc:subfield code="f">Antoine de Saint-Exupéry</mxc:subfield></mxc:datafield>
<mxc:datafield tag="210" ind1=" " ind2=" "><mxc:subfield code="a">[Paris]</mxc:subfield><mxc:subfield code="c">Gallimard</mxc:subfield><mxc:subfield code="d">DL 2007</mxc:subfield></mxc:datafield>
<mxc:datafield tag="215" ind1=" " ind2=" "><mxc:subfield code="a">1 vol. (113 p.)</mxc:subfield><mxc:subfield code="d">18 cm</mxc:subfield></mxc:datafield>
<mxc:datafield tag="330" ind1=" " ind2=" "><mxc:subfield code="a">Le récit des aventures d&apos;un petit garçon &amp; d&apos;un aviateur.</mxc:subfield></mxc:datafield>
<mxc:datafield tag="100" ind1=" " ind2=" "><mxc:subfield code="a">20070503d2007    a  y0frey50      ba</mxc:subfield></mxc:datafield>
<mxc:datafield tag="105" ind1=" " ind2=" "><mxc:subfield code="a">||||z   00|a|</mxc:subfield></mxc:datafield>
<mxc:datafield tag="608" ind1=" " ind2=" "><mxc:subfield code="a">Romans</mxc:subfield><mxc:subfield code="2">CNLJ</mxc:subfield></mxc:datafield>
<mxc:datafield tag="686" ind1=" " ind2=" "><mxc:subfield code="a">809</mxc:subfield></mxc:datafield>
<mxc:datafield tag="700" ind1=" " ind2="|"><mxc:subfield code="a">Saint-Exupéry</mxc:subfield><mxc:subfield code="b">Antoine de</mxc:subfield><mxc:subfield code="4">070</mxc:subfield></mxc:datafield>
</mxc:record></srw:recordData></srw:record>`;

const sudoc = `<record>
<datafield tag="010" ind1="#" ind2="#"><subfield code="a">979-10-401-2204-3</subfield></datafield>
<datafield tag="033" ind1="#" ind2="#"><subfield code="a">http://catalogue.bnf.fr/ark:/12148/cb477061560</subfield><subfield code="2">BNF</subfield></datafield>
<datafield tag="101" ind1="0" ind2=" "><subfield code="a">fre</subfield></datafield>
<datafield tag="200" ind1="1" ind2=" "><subfield code="a">Interdit de me faire mal !</subfield><subfield code="f">Mai Lan Chapiron</subfield></datafield>
<datafield tag="214" ind1=" " ind2="0"><subfield code="a">Paris</subfield><subfield code="c">La Martinière jeunesse</subfield><subfield code="d">DL 2025</subfield></datafield>
<datafield tag="215" ind1=" " ind2=" "><subfield code="a">1 vol. (non paginé [30] p.)</subfield></datafield>
</record>`;

describe('unimarc', () => {
	it('reads a BnF MarcXchange record', () => {
		const b = unimarcToBook(parseUnimarc(bnf))!;
		expect(b).toMatchObject({
			title: 'Le petit prince',
			authors: ['Antoine de Saint-Exupéry'],
			publisher: 'Gallimard',
			publishedYear: 2007,
			language: 'fr',
			pageCount: 113,
			isbn: '9782070612758'
		});
		expect(b.description).toBe("Le récit des aventures d'un petit garçon & d'un aviateur.");
		expect(b.subjects).toEqual(['Romans', 'public:jeunesse', 'forme:roman', 'forme:fiction']);
		expect(b.dewey).toEqual(['809']);
	});

	it('reads a Sudoc MARCXML record, with the 214 field and the BnF ark', () => {
		const b = unimarcToBook(parseUnimarc(sudoc))!;
		expect(b).toMatchObject({
			title: 'Interdit de me faire mal !',
			authors: ['Mai Lan Chapiron'],
			publisher: 'La Martinière jeunesse',
			publishedYear: 2025,
			pageCount: 30,
			bnfArk: 'ark:/12148/cb477061560'
		});
	});

	it('falls back to the secondary responsibility (702) when there is no 700/701', () => {
		const rec = `<srw:record><srw:recordData><mxc:record>
<mxc:datafield tag="200" ind1="1" ind2=" "><mxc:subfield code="a">Bravo, les formes !</mxc:subfield></mxc:datafield>
<mxc:datafield tag="702" ind1=" " ind2="|"><mxc:subfield code="3">18250065</mxc:subfield><mxc:subfield code="a">Sasagawa</mxc:subfield><mxc:subfield code="b">Isamu</mxc:subfield></mxc:datafield>
</mxc:record></srw:recordData></srw:record>`;
		expect(unimarcToBook(parseUnimarc(rec))!.authors).toEqual(['Isamu Sasagawa']);
	});

	it('puts the set a volume belongs to (461) in front of the title, not the collection (225)', () => {
		const rec = `<srw:record><srw:recordData><mxc:record>
<mxc:datafield tag="200" ind1="1" ind2=" "><mxc:subfield code="a">La cavalerie est là</mxc:subfield><mxc:subfield code="f">Kohei Horikoshi</mxc:subfield></mxc:datafield>
<mxc:datafield tag="225" ind1=" " ind2=" "><mxc:subfield code="a">My hero academia</mxc:subfield><mxc:subfield code="v">vol. 42</mxc:subfield></mxc:datafield>
<mxc:datafield tag="461" ind1=" " ind2=" "><mxc:subfield code="0">45059444</mxc:subfield><mxc:subfield code="t">My hero academia</mxc:subfield><mxc:subfield code="v">42</mxc:subfield></mxc:datafield>
</mxc:record></srw:recordData></srw:record>`;
		expect(unimarcToBook(parseUnimarc(rec))!.title).toBe(
			'My hero academia. 42, La cavalerie est là'
		);
		// A publisher's collection alone never reaches the title.
		const folio = `<srw:record><srw:recordData><mxc:record>
<mxc:datafield tag="200" ind1="1" ind2=" "><mxc:subfield code="a">Le petit prince</mxc:subfield></mxc:datafield>
<mxc:datafield tag="225" ind1=" " ind2=" "><mxc:subfield code="a">Folio junior</mxc:subfield><mxc:subfield code="v">100</mxc:subfield></mxc:datafield>
</mxc:record></srw:recordData></srw:record>`;
		expect(unimarcToBook(parseUnimarc(folio))!.title).toBe('Le petit prince');
		// Sudoc already writes the set in 200: no doubling.
		const sudoc = `<record><datafield tag="200"><subfield code="a">My hero academia</subfield><subfield code="h">42</subfield><subfield code="i">La cavalerie est là</subfield></datafield>
<datafield tag="461"><subfield code="t">My hero academia</subfield><subfield code="v">42</subfield></datafield></record>`;
		expect(unimarcToBook(parseUnimarc(sudoc))!.title).toBe(
			'My hero academia. 42, La cavalerie est là'
		);
	});

	it('returns null without a title', () => {
		expect(unimarcToBook(parseUnimarc('<record></record>'))).toBeNull();
	});
});
