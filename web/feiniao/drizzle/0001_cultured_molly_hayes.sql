CREATE TABLE `industry_items` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`summary` text NOT NULL,
	`source` text NOT NULL,
	`category` text NOT NULL,
	`published` text,
	`collected_at` text NOT NULL,
	`disposition` text DEFAULT 'inbox' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `industry_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text NOT NULL,
	`status` text NOT NULL,
	`added` integer NOT NULL,
	`sources` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `industry_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
