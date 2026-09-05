import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { resolveCode } from '$lib/server/circulation';

/** GET /api/scan/<code> → what that barcode / ISBN / RFID uid identifies. */
export const GET: RequestHandler = ({ params }) => json(resolveCode(db, params.code));
