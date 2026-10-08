CREATE TABLE `device_transfer_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`direction` text NOT NULL,
	`remote_path` text NOT NULL,
	`local_path` text NOT NULL,
	`recursive` integer DEFAULT false NOT NULL,
	`run_generation` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`files_transferred` integer DEFAULT 0 NOT NULL,
	`bytes_transferred` integer DEFAULT 0 NOT NULL,
	`total_files` integer,
	`total_bytes` integer,
	`current_file` text,
	`error` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`started_at` text,
	`updated_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`device_id`) REFERENCES `remote_devices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_device_transfer_tasks_device_created` ON `device_transfer_tasks` (`device_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_device_transfer_tasks_status_updated` ON `device_transfer_tasks` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `narrator_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`narrator_id` text NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`source_id` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_narrator_drafts_user_narrator` ON `narrator_drafts` (`user_id`,`narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_narrator_drafts_narrator` ON `narrator_drafts` (`narrator_id`);--> statement-breakpoint
DROP INDEX `idx_file_snapshots_narrator_file`;--> statement-breakpoint
ALTER TABLE `narrator_file_snapshots` ADD `device_id` text DEFAULT 'local' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_file_snapshots_device` ON `narrator_file_snapshots` (`device_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_file_snapshots_narrator_device_file` ON `narrator_file_snapshots` (`narrator_id`,`device_id`,`file_path`);--> statement-breakpoint
DROP INDEX `idx_narrators_handle`;--> statement-breakpoint
ALTER TABLE `narrators` ADD `handle_fold` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_narrators_handle_fold` ON `narrators` (`handle_fold`);--> statement-breakpoint
CREATE INDEX `idx_narrators_handle` ON `narrators` (`handle`);--> statement-breakpoint
ALTER TABLE `file_attributions` ADD `device_id` text DEFAULT 'local' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_file_attr_device_workspace_file` ON `file_attributions` (`device_id`,`workspace_path`,`file_path`,`changed_at`);--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `execution_device_id` text;--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `execution_cwd` text;--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `resolved_file_path` text;--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `device_selection_source` text;--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `is_file_history_checkpoint` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_toolcalls_execution_device` ON `narrator_tool_calls` (`execution_device_id`,`created_at`);