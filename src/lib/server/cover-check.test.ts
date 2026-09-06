import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { looksBlank } from './cover-check';

/** White page with a faint grey word in the middle, the way Google's placeholder looks. */
const faint = () =>
	sharp({
		create: { width: 300, height: 390, channels: 3, background: '#ffffff' }
	})
		.composite([
			{
				input: {
					create: { width: 180, height: 40, channels: 3, background: '#c8c8c8' }
				},
				left: 60,
				top: 170
			}
		])
		.png()
		.toBuffer();

/** White cover with a small black title: pale, but with real contrast. */
const inked = () =>
	sharp({
		create: { width: 300, height: 390, channels: 3, background: '#ffffff' }
	})
		.composite([
			{
				input: { create: { width: 180, height: 40, channels: 3, background: '#101010' } },
				left: 60,
				top: 170
			}
		])
		.png()
		.toBuffer();

describe('looksBlank', () => {
	it('flags a pale grey-on-white placeholder', async () => {
		expect(await looksBlank(new Uint8Array(await faint()))).toBe(true);
	});
	it('keeps a white cover with dark print, and any coloured cover', async () => {
		expect(await looksBlank(new Uint8Array(await inked()))).toBe(false);
		const colour = await sharp({
			create: { width: 200, height: 300, channels: 3, background: { r: 200, g: 40, b: 60 } }
		})
			.png()
			.toBuffer();
		expect(await looksBlank(new Uint8Array(colour))).toBe(false);
	});
	it('answers false for junk', async () => {
		expect(await looksBlank(new Uint8Array([1, 2, 3]))).toBe(false);
	});
});
