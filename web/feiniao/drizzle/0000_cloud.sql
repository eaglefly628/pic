CREATE TABLE `login_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`until_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_chunks` (
	`asset_id` text NOT NULL,
	`part` integer NOT NULL,
	`payload` text NOT NULL,
	`iv` text NOT NULL,
	PRIMARY KEY(`asset_id`, `part`)
);
--> statement-breakpoint
CREATE TABLE `vault` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`envelope` text NOT NULL
);
