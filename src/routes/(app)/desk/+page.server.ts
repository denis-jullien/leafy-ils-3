import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { overdueLoans } from '$lib/server/circulation';
import { dailyActivity, headlineStats, recentActivity, topBooks } from '$lib/server/stats';

export const load: PageServerLoad = () => ({
	stats: headlineStats(db),
	days: dailyActivity(db, 12),
	activity: recentActivity(db, 30),
	top: topBooks(db, 5),
	overdue: overdueLoans(db).slice(0, 50)
});
