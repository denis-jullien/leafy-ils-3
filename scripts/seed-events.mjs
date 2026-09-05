#!/usr/bin/env node
/**
 * Insert a few sample events so the public agenda has something to show.
 * Dates are computed from today so they are always upcoming (Wednesdays and
 * Saturdays, the library's opening days). Does nothing if events already exist,
 * unless you pass --force.
 *
 *   node scripts/seed-events.mjs            # uses DATABASE_URL from .env (default local.db)
 *   DATABASE_URL=/data/library.db node scripts/seed-events.mjs --force
 */
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

function envFromDotenv() {
	try {
		return Object.fromEntries(
			readFileSync('.env', 'utf8')
				.split('\n')
				.filter((l) => l.includes('=') && !l.trim().startsWith('#'))
				.map((l) => {
					const [k, ...v] = l.split('=');
					return [
						k.trim(),
						v
							.join('=')
							.trim()
							.replace(/^["']|["']$/g, '')
					];
				})
		);
	} catch {
		return {};
	}
}

const url = process.env.DATABASE_URL ?? envFromDotenv().DATABASE_URL ?? 'local.db';
const force = process.argv.includes('--force');

const sqlite = new Database(url);
sqlite.pragma('journal_mode = WAL');
migrate(drizzle(sqlite), { migrationsFolder: 'drizzle' });

const existing = sqlite.prepare('select count(*) as n from events').get().n;
if (existing > 0 && !force) {
	console.log(`${existing} event(s) already in ${url}; nothing added. Use --force to add anyway.`);
	process.exit(0);
}

/** Next occurrence of a weekday (1 = Monday … 6 = Saturday), at least `minDays` ahead. */
function next(weekday, minDays = 3, weeksLater = 0) {
	const d = new Date();
	d.setDate(d.getDate() + minDays);
	while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
	d.setDate(d.getDate() + 7 * weeksLater);
	return d.toISOString().slice(0, 10);
}

const samples = [
	{
		date: next(3),
		time: '10h30',
		title: 'Heure du conte',
		tag: 'Jeunesse',
		description: "Histoires et comptines pour les 3–6 ans, suivies d'un goûter."
	},
	{
		date: next(6),
		time: '15h00',
		title: 'Club de lecture',
		tag: 'Adultes',
		description: 'On échange autour du roman du mois. Venez avec vos coups de cœur.'
	},
	{
		date: next(3, 3, 1),
		time: '14h00',
		title: 'Atelier numérique',
		tag: 'Seniors',
		description: 'Prise en main de la tablette et du catalogue en ligne. Sur inscription.'
	},
	{
		date: next(6, 3, 2),
		time: '10h00',
		title: 'Rencontre avec une autrice',
		tag: 'Tout public',
		description: 'Présentation de son dernier livre, suivie de dédicaces.'
	}
];

const insert = sqlite.prepare(
	`insert into events (date, time, title, tag, description, free, created_at, updated_at)
	 values (@date, @time, @title, @tag, @description, 1, @now, @now)`
);
const now = Date.now();
sqlite.transaction(() => {
	for (const s of samples) insert.run({ ...s, now });
})();
console.log(`Added ${samples.length} sample events to ${url}:`);
for (const s of samples) console.log(`  ${s.date} ${s.time}  ${s.title}`);
