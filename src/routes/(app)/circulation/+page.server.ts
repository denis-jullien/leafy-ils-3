import type { PageServerLoad } from './$types';
import { MAX_LOANS_PER_FAMILY } from '$lib/config';

export const load: PageServerLoad = ({ url }) => ({
	/** Pre-select a family, e.g. from the family page: /circulation?family=F000042 */
	initialCode: url.searchParams.get('family') ?? null,
	policy: { maxLoans: MAX_LOANS_PER_FAMILY }
});
