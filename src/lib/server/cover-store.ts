import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import type { Db } from './db/client';
import { books, covers } from './db/schema';
import { takeCachedCover } from './metadata';

/** Every stored cover fits in this box. Big enough for the public page, small to keep. */
export const COVER_MAX = { width: 600, height: 900 };
/**
 * Stored format. WebP: ~15 KB per cover, encodes in milliseconds, displays on
 * anything since 2020. AVIF: ~40 % smaller but ~30× slower to encode and needs
 * Safari 16.1+ (late 2022), so older tablets would show nothing. One line to switch.
 */
const COVER_FORMAT: 'webp' | 'avif' = 'webp';
const QUALITY = { webp: 80, avif: 50 }[COVER_FORMAT];
const MIN_SIDE = 100;
/** Refuse absurd uploads before decoding them. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export class CoverError extends Error {}

export interface NormalisedCover {
	bytes: Buffer;
	mime: string;
	width: number;
	height: number;
	hash: string;
}

/**
 * Decode whatever came in (JPEG, PNG, WebP, GIF, HEIC where libvips has it),
 * honour the EXIF rotation, fit it in COVER_MAX and re-encode as WebP.
 */
export async function normaliseCover(input: Buffer | Uint8Array): Promise<NormalisedCover> {
	if (input.byteLength > MAX_UPLOAD_BYTES)
		throw new CoverError('Image trop lourde (15 Mo maximum).');
	let out;
	try {
		const pipeline = sharp(input)
			.rotate()
			.resize({ ...COVER_MAX, fit: 'inside', withoutEnlargement: true });
		out = await (
			COVER_FORMAT === 'avif'
				? pipeline.avif({ quality: QUALITY })
				: pipeline.webp({ quality: QUALITY })
		).toBuffer({
			resolveWithObject: true
		});
	} catch {
		throw new CoverError("Ce fichier n'est pas une image lisible.");
	}
	if (out.info.width < MIN_SIDE || out.info.height < MIN_SIDE)
		throw new CoverError(`Image trop petite (${out.info.width}×${out.info.height}).`);
	return {
		bytes: out.data,
		mime: `image/${COVER_FORMAT}`,
		width: out.info.width,
		height: out.info.height,
		hash: createHash('sha1').update(out.data).digest('hex')
	};
}

export const coverUrlFor = (bookId: number, hash: string) =>
	`/covers/${bookId}?v=${hash.slice(0, 10)}`;
export const isExternalCover = (url: string | null | undefined) =>
	!!url && /^https?:\/\//i.test(url);

/** Normalise and store; the book's coverUrl becomes the internal, versioned address. */
export async function storeCover(
	db: Db,
	bookId: number,
	input: Buffer | Uint8Array,
	source: string
) {
	const c = await normaliseCover(input);
	const url = coverUrlFor(bookId, c.hash);
	db.transaction((tx) => {
		tx.insert(covers)
			.values({
				bookId,
				mime: c.mime,
				bytes: c.bytes,
				width: c.width,
				height: c.height,
				source,
				hash: c.hash
			})
			.onConflictDoUpdate({
				target: covers.bookId,
				set: {
					mime: c.mime,
					bytes: c.bytes,
					width: c.width,
					height: c.height,
					source,
					hash: c.hash,
					updatedAt: new Date()
				}
			})
			.run();
		tx.update(books).set({ coverUrl: url }).where(eq(books.id, bookId)).run();
	});
	return { url, width: c.width, height: c.height, bytes: c.bytes.length };
}

export function deleteCover(db: Db, bookId: number) {
	db.transaction((tx) => {
		tx.delete(covers).where(eq(covers.bookId, bookId)).run();
		tx.update(books).set({ coverUrl: null }).where(eq(books.id, bookId)).run();
	});
}

export function getCover(db: Db, bookId: number) {
	return db.select().from(covers).where(eq(covers.bookId, bookId)).get();
}

const UA = 'leafy-ils/0.1 (village library catalogue)';

/** Download an external image (the lookup's in-memory copy first), normalise, store. */
export async function importCoverFromUrl(db: Db, bookId: number, url: string, source = 'url') {
	let bytes = takeCachedCover(url);
	if (!bytes) {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 15000);
		try {
			const res = await fetch(url, {
				signal: ctrl.signal,
				headers: { 'User-Agent': UA },
				redirect: 'follow'
			});
			if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/'))
				throw new CoverError(`Image indisponible (${res.status}).`);
			bytes = new Uint8Array(await res.arrayBuffer());
		} finally {
			clearTimeout(timer);
		}
	}
	return storeCover(db, bookId, bytes, source);
}
