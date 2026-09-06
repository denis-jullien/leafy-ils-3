import type { Db } from './db/client';
import {
	CoverError,
	deleteCover,
	importCoverFromUrl,
	isExternalCover,
	storeCover
} from './cover-store';

/**
 * What the book form can ask about the cover, in priority order:
 * an uploaded file, a "remove" tick, or an external URL to bring in.
 * Returns a human message for the toast, or null when nothing changed.
 */
export async function applyCoverFromForm(
	db: Db,
	bookId: number,
	fd: FormData,
	coverUrl: string | null | undefined
): Promise<string | null> {
	const file = fd.get('coverFile');
	const remove = fd.get('removeCover') === 'on';
	try {
		if (file instanceof File && file.size > 0) {
			const r = await storeCover(db, bookId, new Uint8Array(await file.arrayBuffer()), 'upload');
			return `Couverture enregistrée (${r.width}×${r.height}, ${Math.round(r.bytes / 1024)} Ko)`;
		}
		if (remove) {
			deleteCover(db, bookId);
			return 'Couverture retirée';
		}
		if (isExternalCover(coverUrl)) {
			const r = await importCoverFromUrl(db, bookId, coverUrl!, 'url');
			return `Couverture rapatriée (${r.width}×${r.height}, ${Math.round(r.bytes / 1024)} Ko)`;
		}
		return null;
	} catch (err) {
		if (err instanceof CoverError) throw err;
		throw new CoverError(`Couverture non enregistrée : ${(err as Error).message}`);
	}
}
