/// <reference types="w3c-web-serial" />
import type { AuthSession, AuthUser } from '$lib/server/auth';

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			user?: AuthUser;
			session?: AuthSession;
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
