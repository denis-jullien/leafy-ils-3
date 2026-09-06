import sharp from 'sharp';

/**
 * A "no cover available" picture: pale grey text on white, no colour, almost no
 * contrast. Google draws these on demand at whatever size is asked, so sizes and
 * hashes alone never catch every variant. A real cover, even a white one, has ink.
 */
export async function looksBlank(bytes: Uint8Array): Promise<boolean> {
	try {
		const { channels } = await sharp(bytes).removeAlpha().stats();
		const rgb =
			channels.length >= 3 ? channels.slice(0, 3) : [channels[0], channels[0], channels[0]];
		const means = rgb.map((c) => c.mean);
		const pale = Math.min(...means) >= 240;
		const grey = Math.max(...means) - Math.min(...means) < 2;
		const flat = Math.max(...rgb.map((c) => c.stdev)) <= 28;
		return pale && grey && flat;
	} catch {
		return false;
	}
}
