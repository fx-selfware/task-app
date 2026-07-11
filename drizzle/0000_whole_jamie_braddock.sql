CREATE TABLE `task_list_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`permission` text DEFAULT 'READ' NOT NULL,
	`created_at` integer NOT NULL,
	`task_list_id` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`task_list_id`) REFERENCES `task_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_list_shares_list_user_uq` ON `task_list_shares` (`task_list_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `task_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'TODO' NOT NULL,
	`order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`task_list_id` text NOT NULL,
	`parent_id` text,
	FOREIGN KEY (`task_list_id`) REFERENCES `task_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tasks_list_order_idx` ON `tasks` (`task_list_id`,`order`);--> statement-breakpoint
CREATE INDEX `tasks_parent_order_idx` ON `tasks` (`parent_id`,`order`);--> statement-breakpoint
CREATE TABLE `template_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`permission` text DEFAULT 'READ' NOT NULL,
	`created_at` integer NOT NULL,
	`template_id` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `task_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_shares_template_user_uq` ON `template_shares` (`template_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `template_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`order` integer NOT NULL,
	`template_id` text NOT NULL,
	`parent_id` text,
	FOREIGN KEY (`template_id`) REFERENCES `task_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `template_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `template_tasks_template_order_idx` ON `template_tasks` (`template_id`,`order`);--> statement-breakpoint
CREATE INDEX `template_tasks_parent_order_idx` ON `template_tasks` (`parent_id`,`order`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'USER' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);