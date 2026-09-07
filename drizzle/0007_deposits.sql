CREATE TABLE `deposit_moves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deposit_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`kind` text NOT NULL,
	`at` integer NOT NULL,
	`by` text,
	FOREIGN KEY (`deposit_id`) REFERENCES `deposits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `deposit_moves_deposit_idx` ON `deposit_moves` (`deposit_id`);--> statement-breakpoint
CREATE INDEX `deposit_moves_at_idx` ON `deposit_moves` (`at`);--> statement-breakpoint
CREATE TABLE `deposits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`received_on` text NOT NULL,
	`return_on` text NOT NULL,
	`notes` text,
	`closed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `deposits_return_idx` ON `deposits` (`return_on`);--> statement-breakpoint
DROP INDEX `books_isbn13_unique`;--> statement-breakpoint
ALTER TABLE `books` ADD `deposit_id` integer REFERENCES deposits(id);--> statement-breakpoint
CREATE INDEX `books_deposit_idx` ON `books` (`deposit_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `books_isbn_own_uidx` ON `books` (`isbn13`) WHERE deposit_id IS NULL;