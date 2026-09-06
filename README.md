# Leafy ILS

A small library system for a village library run by volunteers. Memberships are per
family, and the whole design serves one moment: a volunteer at the desk with a family's
name and a pile of books.

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
npm run db:seed:events        # four sample events for the public agenda
```

## Public site

`/` is the public welcome page from the "Accueil - Les lecteurs des Arbousiers" design:
catalogue search with category chips, the volunteers' picks, upcoming events, opening
hours with today highlighted, address, contact and how to join. It needs no login.

- Hours, contact and membership text live in `src/lib/content/site.ts`.
- Events are managed from the desk (**Événements**). The next four show on the public
  site; past ones disappear on their own. `npm run db:seed:events` adds four samples.
- The library name is in `src/lib/config.ts`. Rayons (shelves) are managed on the desk.
- Put the emblem at `static/logo.jpg` (square). A teal "LA" disc shows until then.
- Books flagged **Coup de cœur** on the desk appear first; books added in the last 30 days
  get a **Nouveau** badge. The search box also accepts an ISBN.
- Every card links to a public book page, `/livre/<id>`, with the summary, details, the
  expected return date when the book is out, and other titles by the same author.
- The public site only ever exposes title, authors, publisher, year, cover, category,
  description and availability (`src/lib/server/catalogue.ts`).

## How the desk works

- **Circulation** page: one input, always ready. Type a few letters of the family name and
  pick it, scan the books in any order, press **Prêter**. Books scanned while on loan go
  to a returns list, applied together with **Valider**. Nothing is recorded before that.
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

Loan policy lives in `src/lib/config.ts` (21 days, 10 books per family, one renewal).

## ISBN lookup and covers

`src/lib/server/metadata.ts` asks the providers in `ISBN_PROVIDERS` order and merges their
answers, the first one winning per field: BnF (UNIMARC through SRU, with the summary and
a cover keyed by the record's ARK), Sudoc (UNIMARC, links to the BnF record), Google Books
and Open Library. Cover candidates are fetched and checked: not an image, smaller than
100 px, or a known placeholder means rejected. Google Books' key-free cover address is tried
too, with its placeholder images filtered out, as are ePagine (the image service behind
French booksellers' sites, by far the best coverage for books distributed in France) and
Inventaire.io. `COVER_SOURCES` sets the order and lets you drop a source. A web image search
by ISBN is the last resort: `BRAVE_SEARCH_KEY` (Brave Search API, free tier) or, for those who still have
access, Google's Custom Search JSON API (`GOOGLE_CSE_KEY` + `GOOGLE_CSE_ID`, closed to new
customers). Without a key the form offers a "Chercher sur Google Images" link and a field to
paste the image address.

On the desk, **Chercher la notice** fills the empty fields of a book form, and the books
list has **Chercher les couvertures manquantes**, which processes ten books per click.

### Cover storage

Covers are stored in the database (`covers` table), not hotlinked. Whatever the source, a
photo from a phone, a file, or an image found by the lookup, the server decodes it,
honours its rotation, fits it in 600×900 and re-encodes it as WebP at quality 80
(`src/lib/server/cover-store.ts`; the format is a one-line constant, AVIF is the other
option). They are served at `/covers/<id>?v=<hash>` with a one-year immutable cache and an
ETag. The book form lets a volunteer upload or replace a cover (the browser shrinks big
photos first) or remove it; an image address found online is brought in at save time. The
books list has **Rapatrier les couvertures externes** for books that still point elsewhere.
Litestream replicates the database file, so covers are in the backups.

## Rayons and automatic shelving

A rayon is both where a book sits and how the public site groups it. The list is edited
on the desk (**Rayons**, from the books list). Each rayon carries matching rules used when
a record is fetched: comma-separated keywords, matched whole-word and accent-insensitively
against the record's subject and genre headings (BnF and Sudoc RAMEAU, Google categories,
Open Library subjects) and against signals derived from UNIMARC coded fields
(`public:jeunesse`, `public:ado`, `public:adulte`, `forme:roman`, `forme:documentaire`…), plus
Dewey prefixes or ranges matched against the record's class number. Rayons are tried in
order and the first match wins, so the order is editable too. The Rayons page has a tester:
paste an ISBN and see the signals and the proposal. Logic lives in `src/lib/classify.ts`.

### Optional local model (in the browser)

When the rules find nothing, a small multilingual embedding model can propose a rayon. It
runs in the browser through transformers.js (`Xenova/multilingual-e5-small`, about 120 MB
downloaded once, WebGPU when available, CPU otherwise), so the server stays tiny and no data
leaves the machine. Switch it on per browser from the Rayons page; meant for a laptop during
cataloguing, not for the desk tablet. It compares the book (title, authors, subject headings,
and the blurb with a lower weight) with each rayon's description and with summarised books
already on that rayon, and reports a confidence from the margin over the runner-up. Only
rayons described by at least a sentence take part, and richer descriptions with familiar
series and authors make it markedly more accurate. The Rayons page also offers a batch pass
over unshelved books with a review table before anything is saved. Code in `src/lib/embed/`.

## Desk lists

The books and families lists sort, filter and page on the server: the state lives in the
URL (`?sort=&dir=&page=` plus one param per column filter), SQLite does the work, and only
the fifty rows shown are sent. Filters sit in the table header under each column: text
applies as you type, dropdowns on change, and focus is kept across the reload. Short fields are editable in place and save on their own through
`PATCH /api/books/:id` and `PATCH /api/families/:id`, which accept only those fields:
shelf, category, coup de cœur and state for books, phone and membership for families.

## Deploy to Fly.io

```sh
fly launch --no-deploy --copy-config     # uses fly.toml, pick your app name and region
fly volumes create data --size 3 --region cdg   # covers live in the database too
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
