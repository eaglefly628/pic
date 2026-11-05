CREATE TABLE `macro_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`series_id` text NOT NULL,
	`period` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quant_results` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`payload` text NOT NULL
);
