import { json } from '@sveltejs/kit';
import { CirculationError } from './circulation';

/** Uniform error body for the JSON endpoints: { error, code? }. */
export function apiError(err: unknown) {
	if (err instanceof CirculationError)
		return json({ error: err.message, code: err.code }, { status: 409 });
	console.error(err);
	return json({ error: 'Erreur inattendue' }, { status: 500 });
}

export async function readJson<T>(request: Request): Promise<T> {
	try {
		return (await request.json()) as T;
	} catch {
		throw new TypeError('Le corps de la requête doit être du JSON');
	}
}
