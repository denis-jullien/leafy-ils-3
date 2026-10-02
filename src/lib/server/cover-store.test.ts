import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createDb } from './db/client';
import { runMigrations } from './db/migrate';
import { books } from './db/schema';
import { applyCoverFromForm } from './book-cover-actions';
import {
	CoverError,
	COVER_MAX,
	deleteCover,
	getCover,
	normaliseCover,
	storeCover
} from './cover-store';

const image = (w: number, h: number, format: 'jpeg' | 'png') =>
	sharp({ create: { width: w, height: h, channels: 3, background: { r: 30, g: 120, b: 160 } } })
		[format]()
		.toBuffer();

describe('cover store', () => {
	it('normalises any input to WebP inside the box, without enlarging', async () => {
		const big = await normaliseCover(await image(2000, 3000, 'jpeg'));
		expect(big.mime).toBe('image/webp');
		expect(big.width).toBe(COVER_MAX.width);
		expect(big.height).toBe(COVER_MAX.height);
		const small = await normaliseCover(await image(300, 400, 'png'));
		expect([small.width, small.height]).toEqual([300, 400]);
		expect(small.hash).toMatch(/^[0-9a-f]{40}$/);
	});

	it('refuses junk and tiny images', async () => {
		await expect(normaliseCover(Buffer.from('not an image'))).rejects.toBeInstanceOf(CoverError);
		await expect(normaliseCover(await image(40, 60, 'png'))).rejects.toBeInstanceOf(CoverError);
	});

	it('stores, versions the book URL, and deletes', async () => {
		const db = createDb(':memory:');
		runMigrations(db);
		const book = db.insert(books).values({ title: 'Test' }).returning().get();
		const r = await storeCover(db, book.id, await image(500, 700, 'jpeg'), 'upload');
		expect(r.url).toMatch(new RegExp(`^/covers/${book.id}\\?v=[0-9a-f]{10}$`));
		expect(getCover(db, book.id)?.mime).toBe('image/webp');
		expect(db.select().from(books).get()?.coverUrl).toBe(r.url);
		deleteCover(db, book.id);
		expect(getCover(db, book.id)).toBeUndefined();
		expect(db.select().from(books).get()?.coverUrl).toBeNull();
	});

	it('accepts a local image upload without fetching an external URL', async () => {
		const db = createDb(':memory:');
		runMigrations(db);
		const book = db.insert(books).values({ title: 'Local upload' }).returning().get();
		const fd = new FormData();
		fd.set(
			'coverFile',
			new File([new Uint8Array(await image(300, 400, 'png'))], 'phone.png', { type: 'image/png' })
		);
		await expect(
			applyCoverFromForm(db, book.id, fd, 'http://127.0.0.1/blocked')
		).resolves.toContain('enregistrée');
		expect(getCover(db, book.id)?.source).toBe('upload');
		expect(getCover(db, book.id)?.mime).toBe('image/webp');
	});
});
