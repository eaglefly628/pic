CREATE TABLE `ai_industry_items` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`summary` text NOT NULL,
	`source` text NOT NULL,
	`category` text NOT NULL,
	`published` text,
	`collected_at` text NOT NULL,
	`disposition` text DEFAULT 'inbox' NOT NULL,
	`zh_title` text,
	`zh_summary` text,
	`localized_at` text,
	`localization_basis` text
);
--> statement-breakpoint
CREATE TABLE `ai_industry_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text NOT NULL,
	`status` text NOT NULL,
	`added` integer NOT NULL,
	`sources` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_industry_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
