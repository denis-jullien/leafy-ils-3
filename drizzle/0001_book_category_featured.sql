ALTER TABLE `books` ADD `category` text;--> statement-breakpoint
ALTER TABLE `books` ADD `featured` integer DEFAULT false NOT NULL;