CREATE TABLE `shanghai_events` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`first_seen` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shanghai_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`checked_at` text NOT NULL,
	`report` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shanghai_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
