# Leafy ILS

A small library system for a village library run by volunteers. Memberships are per
family, and the whole design serves one moment: a volunteer at the desk scanning a card
and a pile of books.

## Stack

| Layer    | Choice                                                   |
| -------- | -------------------------------------------------------- |
| App      | SvelteKit (Svelte 5, TypeScript), adapter-node           |
| Database | SQLite via Drizzle ORM, migrations in `drizzle/`         |
| Auth     | Better Auth with the admin plugin (no public sign-up)    |
| UI       | Tailwind CSS 4, shadcn-svelte, superforms + Zod          |
| Metadata | Google Books, Open Library, BnF SRU (order configurable) |
| Hosting  | Fly.io, one small machine + volume, Litestream backups   |
| Tests    | Vitest (unit), Playwright (e2e)                          |

## Run it locally

```sh
cp .env.example .env          # then set BETTER_AUTH_SECRET
npm install
npm run dev
```

Open http://localhost:5173. The first visit goes to `/setup`, where you create the
administrator. Migrations run automatically at start.

Useful scripts:

```sh
npm run test:unit -- --run    # unit tests (ISBN parsing, circulation rules)
npm run check                 # svelte-check
npm run lint                  # prettier + eslint
npm run db:generate           # new migration after editing src/lib/server/db/schema.ts
npm run auth:schema           # regenerate Better Auth tables after changing auth.ts
npm run db:studio             # browse the database
```

## Public site

`/` is the public welcome page from the "Accueil - Les lecteurs des Arbousiers" design:
catalogue search with category chips, the volunteers' picks, upcoming events, opening
hours with today highlighted, address, contact and how to join. It needs no login.

- Text content (hours, contact, membership, events) lives in `src/lib/content/site.ts`.
  Past events disappear on their own.
- Categories and the library name are in `src/lib/config.ts`.
- Put the emblem at `static/logo.jpg` (square). A teal "LA" disc shows until then.
- Books flagged **Coup de cœur** on the desk appear first; books added in the last 30 days
  get a **Nouveau** badge. The search box also accepts an ISBN.
- Every card links to a public book page, `/livre/<id>`, with the summary, details, the
  expected return date when the book is out, and other titles by the same author.
- The public site only ever exposes title, authors, publisher, year, cover, category,
  description and availability (`src/lib/server/catalogue.ts`).

## How the desk works

- **Circulation** page: one input, always ready. Scan a family card (`F000042`) and books
  in any order, press **Lend**. Scanning a book that is out returns it, whoever brings it.
- **Barcode scanners** work out of the box: a USB scanner types the code and presses
  Enter. The page also listens for that burst of keystrokes when no field is focused.
- **RFID readers**: three options, all behind the same `ScanSource` interface in
  `src/lib/scan/`.
  1. A reader in keyboard-wedge mode needs nothing.
  2. RS232 / USB-serial readers connect straight from Chrome or Edge through the Web
     Serial API (**Readers** panel on the circulation page).
  3. TCP/IP readers (or serial readers on other browsers) go through
     [`tools/reader-bridge`](tools/reader-bridge/README.md), a tiny Node program on the
     library PC that relays reads to the page over `ws://localhost:8787`.
- **Books** are one row per physical copy. The barcode is the ISBN-13 when there is one,
  else an internal `B000123` label printed from the book page. RFID tag UIDs are stored on
  the book (`rfid_uid`). Duplicates are rejected by unique indexes.
- **Family cards** print from the family page, credit-card sized, Code 128.

Loan policy lives in `src/lib/config.ts` (21 days, 10 books per family, one renewal).

## Deploy to Fly.io

```sh
fly launch --no-deploy --copy-config     # uses fly.toml, pick your app name and region
fly volumes create data --size 1 --region cdg
fly secrets set BETTER_AUTH_SECRET="$(openssl rand -base64 32)" ORIGIN="https://<app>.fly.dev"
# optional, strongly recommended: Litestream to Cloudflare R2 or Backblaze B2
fly secrets set LITESTREAM_REPLICA_URL="s3://<bucket>/library" \
  LITESTREAM_ENDPOINT="https://<account>.r2.cloudflarestorage.com" \
  LITESTREAM_ACCESS_KEY_ID=... LITESTREAM_SECRET_ACCESS_KEY=...
fly deploy
```

Set `ORIGIN` in `fly.toml` (or as a secret) to the real public URL, or sign-in cookies
will be refused. The machine stops when idle and starts on the first request.

The same Docker image runs anywhere with a persistent disk: a Raspberry Pi in the
library with Tailscale is a fine alternative if the internet connection is unreliable.

## Layout

```
src/lib/server/db/         schema, client, migrations runner
src/lib/server/            auth, circulation rules, books/families persistence, ISBN metadata
src/lib/scan/              ScanSource abstraction: keyboard wedge, Web Serial, bridge
src/lib/components/        forms, barcode, scanner panel, nav
src/routes/(public)/       welcome page and public book pages
src/routes/(app)/          desk: dashboard, circulation, books, families, admin
src/routes/api/            JSON endpoints used by the circulation page
tools/reader-bridge/       local relay for TCP/IP and serial readers
drizzle/                   SQL migrations
```
