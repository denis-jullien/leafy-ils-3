/** Read the pixel size of a JPEG, PNG, GIF or WebP from its first bytes. Enough to reject placeholders. */
export function imageSize(buf: Uint8Array): { width: number; height: number; type: string } | null {
	const b = buf;
	const u16be = (i: number) => (b[i] << 8) | b[i + 1];
	const u16le = (i: number) => b[i] | (b[i + 1] << 8);
	const u32be = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

	if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
		return { width: u32be(16), height: u32be(20), type: 'png' };

	if (b.length > 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46)
		return { width: u16le(6), height: u16le(8), type: 'gif' };

	if (
		b.length > 30 &&
		b[0] === 0x52 &&
		b[1] === 0x49 &&
		b[2] === 0x46 &&
		b[3] === 0x46 &&
		b[8] === 0x57 &&
		b[9] === 0x45
	) {
		const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
		if (chunk === 'VP8 ')
			return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff, type: 'webp' };
		if (chunk === 'VP8L') {
			const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
			return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, type: 'webp' };
		}
		if (chunk === 'VP8X')
			return {
				width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
				height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
				type: 'webp'
			};
	}

	if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
		let i = 2;
		while (i + 9 < b.length) {
			if (b[i] !== 0xff) {
				i++;
				continue;
			}
			const marker = b[i + 1];
			if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
				i += 2;
				continue;
			}
			const len = u16be(i + 2);
			// SOF0..SOF15 except DHT (C4), JPG (C8), DAC (CC)
			if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
				return { height: u16be(i + 5), width: u16be(i + 7), type: 'jpeg' };
			i += 2 + len;
		}
	}
	return null;
}
