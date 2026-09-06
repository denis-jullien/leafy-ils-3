import { localModel } from './local-model.svelte';
import {
	bookTexts,
	combine,
	describesItself,
	rankShelves,
	shelfText,
	type BookForEmbedding,
	type Proposal,
	type ShelfForEmbedding
} from './similarity';

export interface ShelfExample {
	shelfId: number;
	text: string;
}

export interface ShelfContext {
	shelves: ShelfForEmbedding[];
	/** Books already shelved by the volunteers, as plain text. */
	examples: ShelfExample[];
}

let contextPromise: Promise<ShelfContext> | null = null;

/** Shelves and a sample of shelved books, fetched once per page. */
export function loadShelfContext(force = false): Promise<ShelfContext> {
	if (!contextPromise || force) {
		contextPromise = fetch('/api/shelves')
			.then((r) => r.json())
			.catch((e) => {
				contextPromise = null;
				throw e;
			});
	}
	return contextPromise;
}

export interface LocalProposal extends Proposal {
	shelfName: string;
	runnerUpName: string | null;
}

/** Ask the local model which shelf fits a book. Throws if the model can't load. */
export async function proposeShelfLocally(
	book: BookForEmbedding,
	ctx?: ShelfContext
): Promise<LocalProposal | null> {
	const context = ctx ?? (await loadShelfContext());
	// A shelf with nothing but a name gives the model nothing to compare with.
	const shelves = context.shelves.filter(describesItself);
	if (shelves.length === 0) return null;
	const ids = new Set(shelves.map((s) => s.id));
	const examples = context.examples.filter((e) => ids.has(e.shelfId));
	const shelfTexts = shelves.map(shelfText);
	const exampleTexts = examples.map((e) => `query: ${e.text}`);
	const parts = bookTexts(book);
	const vectors = await localModel.embed([
		...parts.map((p) => p.text),
		...shelfTexts,
		...exampleTexts
	]);
	const bookVec = combine(
		vectors.slice(0, parts.length),
		parts.map((p) => p.weight)
	);
	const rest = vectors.slice(parts.length);
	const shelfVectors = shelves.map((s, i) => ({ shelfId: s.id, vector: rest[i] }));
	const exampleVectors = examples.map((e, i) => ({
		shelfId: e.shelfId,
		vector: rest[shelfTexts.length + i]
	}));
	const p = rankShelves(bookVec, shelfVectors, exampleVectors);
	if (!p) return null;
	const name = (id: number | null) => shelves.find((s) => s.id === id)?.name ?? null;
	return { ...p, shelfName: name(p.shelfId) ?? '?', runnerUpName: name(p.runnerUp) };
}

export const confidenceLabel: Record<Proposal['confidence'], string> = {
	sure: 'sûr',
	likely: 'probable',
	unsure: 'incertain'
};
