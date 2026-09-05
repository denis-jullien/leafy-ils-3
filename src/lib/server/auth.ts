import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { admin } from 'better-auth/plugins';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { getRequestEvent } from '$app/server';
import { count } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';

export const ROLES = ['admin', 'user'] as const; // 'user' is shown as "volunteer" in the UI
export type Role = (typeof ROLES)[number];

async function userCount() {
	const [row] = await db.select({ n: count() }).from(user);
	return row?.n ?? 0;
}

/**
 * Volunteers never self-register. The only open sign-up is the very first
 * account (see /setup), which becomes the administrator. Every later account
 * is created by an admin from /admin/volunteers through the admin plugin.
 */
export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	emailAndPassword: { enabled: true, minPasswordLength: 8 },
	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			if (ctx.path === '/sign-up/email' && (await userCount()) > 0) {
				throw new APIError('FORBIDDEN', {
					message: 'Sign-up is closed. Ask an administrator to create your account.'
				});
			}
		})
	},
	databaseHooks: {
		user: {
			create: {
				before: async (data) => {
					const first = (await userCount()) === 0;
					return { data: { ...data, role: first ? 'admin' : (data.role ?? 'user') } };
				}
			}
		}
	},
	plugins: [
		admin({ defaultRole: 'user', adminRoles: ['admin'] }),
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session.session;
