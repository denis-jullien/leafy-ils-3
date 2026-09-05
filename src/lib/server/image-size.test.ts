import { describe, expect, it } from 'vitest';
import { imageSize } from './image-size';

const png = (w: number, h: number) => {
	const b = new Uint8Array(33);
	b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
	new DataView(b.buffer).setUint32(16, w);
	new DataView(b.buffer).setUint32(20, h);
	return b;
};
const gif = (w: number, h: number) => {
	const b = new Uint8Array(16);
	b.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
	new DataView(b.buffer).setUint16(6, w, true);
	new DataView(b.buffer).setUint16(8, h, true);
	return b;
};
const jpeg = (w: number, h: number) => {
	// SOI, APP0 (empty-ish), SOF0 with the size
	const b = new Uint8Array([
		0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0, 0, 0, 0, 0x03
	]);
	new DataView(b.buffer).setUint16(13, h);
	new DataView(b.buffer).setUint16(15, w);
	return b;
};

describe('imageSize', () => {
	it('reads png, gif and jpeg headers', () => {
		expect(imageSize(png(400, 583))).toMatchObject({ width: 400, height: 583, type: 'png' });
		expect(imageSize(gif(1, 1))).toMatchObject({ width: 1, height: 1, type: 'gif' });
		expect(imageSize(jpeg(92, 138))).toMatchObject({ width: 92, height: 138, type: 'jpeg' });
	});
	it('rejects non-images', () => {
		expect(imageSize(new TextEncoder().encode('<html>not found</html>'))).toBeNull();
	});
});
