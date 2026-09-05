import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { building } from '$app/environment';
import { count } from 'drizzle-orm';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { runMigrations } from '$lib/server/db/migrate';
import { user } from '$lib/server/db/schema';
import { svelteKitHandler } from 'better-auth/svelte-kit';

/** Bring the SQLite file up to date every time the server starts. */
export const init: ServerInit = async () => {
	if (building) return;
	runMigrations(db);
};

/** Paths reachable without a session. Everything else needs a logged-in volunteer. */
const PUBLIC = [
	/^\/$/,
	/^\/livre\/[^/]+$/,
	/^\/login$/,
	/^\/setup$/,
	/^\/api\/auth(\/|$)/,
	/^\/health$/
];

let hasUsers = false; // once true, stays true; saves a query per request
async function anyUserExists() {
	if (hasUsers) return true;
	const [row] = await db.select({ n: count() }).from(user);
	hasUsers = (row?.n ?? 0) > 0;
	return hasUsers;
}

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	const session = await auth.api.getSession({ headers: event.request.headers });
	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	const isPublic = PUBLIC.some((re) => re.test(pathname));

	// First run: no accounts yet, send everyone to the setup page.
	const setupExempt =
		pathname === '/setup' || pathname === '/health' || pathname.startsWith('/api/auth');
	if (!setupExempt && !(await anyUserExists())) {
		redirect(303, '/setup');
	}

	if (!isPublic && !event.locals.user) {
		const next = encodeURIComponent(pathname + event.url.search);
		redirect(303, `/login?next=${next}`);
	}

	if (pathname.startsWith('/admin') && event.locals.user?.role !== 'admin') {
		redirect(303, '/desk');
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
