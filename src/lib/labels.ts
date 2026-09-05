/** French labels for the enums stored in the database. Keys stay English in code. */
export const BOOK_STATUS: Record<'active' | 'lost' | 'withdrawn', string> = {
	active: 'en collection',
	lost: 'perdu',
	withdrawn: 'retiré'
};

export const FAMILY_STATUS: Record<'active' | 'inactive', string> = {
	active: 'actif',
	inactive: 'inactif'
};

export const ROLE: Record<'admin' | 'user', string> = {
	admin: 'administrateur',
	user: 'bénévole'
};

export const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);
