import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';

/** Fly.io health check target. Also proves the database file is readable. */
export const GET = () => {
	db.get(sql`select 1`);
	return json({ ok: true });
};
