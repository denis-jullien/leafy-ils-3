/** French labels for the enums stored in the database. Keys stay English in code. */
export const BOOK_STATUS: Record<'active' | 'lost' | 'withdrawn' | 'returned', string> = {
	active: 'en collection',
	lost: 'perdu',
	withdrawn: 'retiré',
	returned: 'rendu au département'
};
/** Statuses a volunteer may pick by hand; 'returned' comes from the deposit page's scan. */
export const OWN_BOOK_STATUSES = ['active', 'lost', 'withdrawn'] as const;

export const FAMILY_STATUS: Record<'active' | 'inactive', string> = {
	active: 'actif',
	inactive: 'inactif'
};

export const ROLE: Record<'admin' | 'user', string> = {
	admin: 'administrateur',
	user: 'bénévole'
};

export const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

/** Values of the "État" header filter on the books list. */
export const ETAT_OPTIONS = [
	{ value: '', label: 'Tous' },
	{ value: 'dispo', label: 'Disponibles' },
	{ value: 'pret', label: 'En prêt' },
	{ value: 'active', label: 'En collection' },
	{ value: 'lost', label: 'Perdus' },
	{ value: 'withdrawn', label: 'Retirés' },
	{ value: 'returned', label: 'Rendus au département' }
] as const;
