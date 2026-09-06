CREATE TABLE `covers` (
	`book_id` integer PRIMARY KEY NOT NULL,
	`mime` text NOT NULL,
	`bytes` blob NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`source` text,
	`hash` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
