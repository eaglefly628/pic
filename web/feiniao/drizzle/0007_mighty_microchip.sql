CREATE TABLE `pic_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`label` text NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL
);
