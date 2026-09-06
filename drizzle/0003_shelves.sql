CREATE TABLE `shelves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`keywords` text,
	`dewey` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shelves_name_unique` ON `shelves` (`name`);--> statement-breakpoint
CREATE INDEX `shelves_position_idx` ON `shelves` (`position`);--> statement-breakpoint
ALTER TABLE `books` ADD `shelf_id` integer REFERENCES shelves(id) ON DELETE set null;--> statement-breakpoint
CREATE INDEX `books_shelf_idx` ON `books` (`shelf_id`);--> statement-breakpoint
-- Default shelves, in matching order. Keywords hit subject/genre headings and the
-- signals the lookup derives (public:jeunesse, forme:roman…); dewey hits class numbers.
INSERT INTO `shelves` (`name`, `position`, `keywords`, `dewey`, `created_at`, `updated_at`) VALUES
	('Jeunesse', 1, 'public:jeunesse, public:ado, jeunesse, enfants, enfant, album, albums, contes, livres d''images, juvenile, children, children''s', NULL, strftime('%s','now') * 1000, strftime('%s','now') * 1000),
	('BD & Mangas', 2, 'bande dessinée, bandes dessinées, manga, mangas, comics, roman graphique, romans graphiques, graphic novel, graphic novels', '741.5', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
	('Polars', 3, 'roman policier, romans policiers, polar, polars, thriller, thrillers, policier, policiers, roman d''espionnage, mystery, detective, crime', NULL, strftime('%s','now') * 1000, strftime('%s','now') * 1000),
	('Romans', 4, 'roman, romans, fiction, nouvelles, forme:roman, forme:nouvelles, forme:fiction, literary fiction', '800-899', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
	('Documentaires', 5, 'documentaire, documentaires, forme:documentaire, guide, guides, histoire, sciences, nature, cuisine, jardinage, biographie, biographies', '000-799, 900-999', strftime('%s','now') * 1000, strftime('%s','now') * 1000);--> statement-breakpoint
-- Existing free-text shelves become shelves of their own (they are the physical rayons)…
INSERT INTO `shelves` (`name`, `position`, `created_at`, `updated_at`)
	SELECT DISTINCT trim(`shelf`), 100, strftime('%s','now') * 1000, strftime('%s','now') * 1000
	FROM `books`
	WHERE `shelf` IS NOT NULL AND trim(`shelf`) != '' AND trim(`shelf`) NOT IN (SELECT `name` FROM `shelves`);--> statement-breakpoint
UPDATE `books` SET `shelf_id` = (SELECT `id` FROM `shelves` WHERE `name` = trim(`books`.`shelf`))
	WHERE `shelf` IS NOT NULL AND trim(`shelf`) != '';--> statement-breakpoint
-- …and books that only had a category get the matching default shelf.
UPDATE `books` SET `shelf_id` = (SELECT `id` FROM `shelves` WHERE `name` = CASE `books`.`category`
		WHEN 'romans' THEN 'Romans' WHEN 'jeunesse' THEN 'Jeunesse' WHEN 'bd' THEN 'BD & Mangas'
		WHEN 'polars' THEN 'Polars' WHEN 'docs' THEN 'Documentaires' END)
	WHERE `shelf_id` IS NULL AND `category` IS NOT NULL;
