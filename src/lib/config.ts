/** Library policy. Small enough to live in code until someone asks for a settings page. */
export const LOAN_DAYS = 21;
export const MAX_LOANS_PER_FAMILY = 10;
export const MAX_RENEWALS = 1;
export const LIBRARY_NAME = 'Les lecteurs des Arbousiers';
export const TIMEZONE = 'Europe/Paris';

/** Public catalogue categories. The id is what gets stored on the book. */
export const CATEGORIES = [
	{ id: 'romans', label: 'Romans' },
	{ id: 'jeunesse', label: 'Jeunesse' },
	{ id: 'bd', label: 'BD & Mangas' },
	{ id: 'polars', label: 'Polars' },
	{ id: 'docs', label: 'Documentaires' }
] as const;
export type CategoryId = (typeof CATEGORIES)[number]['id'];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
