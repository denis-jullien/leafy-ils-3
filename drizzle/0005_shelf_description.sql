ALTER TABLE `shelves` ADD `description` text;--> statement-breakpoint
UPDATE `shelves` SET `description` = CASE `name`
	WHEN 'Jeunesse' THEN 'Livres pour les enfants et les tout-petits : albums illustrés, contes, comptines, premiers romans, romans jeunesse, histoires pour s''endormir, Petit Ours Brun, T''choupi, Harry Potter.'
	WHEN 'BD & Mangas' THEN 'Bandes dessinées, BD, albums de bande dessinée, mangas, comics, romans graphiques, séries dessinées comme Astérix, Tintin, Lucky Luke, Naruto, One Piece, Titeuf.'
	WHEN 'Polars' THEN 'Romans policiers, polars, thrillers, romans noirs, enquêtes criminelles, inspecteur, commissaire, meurtre, suspense, espionnage, Agatha Christie, Fred Vargas, Millénium.'
	WHEN 'Romans' THEN 'Romans et nouvelles pour adultes, littérature générale et classique, romans historiques, romans d''amour, science-fiction, fantasy, prix littéraires, Zola, Camus, Musso, Dune, 1984.'
	WHEN 'Documentaires' THEN 'Livres documentaires et pratiques : histoire, géographie, sciences, nature, animaux, santé, cuisine et recettes, jardinage, bricolage, guides de voyage, biographies, livres pour les nuls.'
	END WHERE `description` IS NULL;
