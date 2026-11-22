CREATE TABLE `folder_git_identity_bindings` (
	`id` text PRIMARY KEY NOT NULL,
	`folder_id` text NOT NULL,
	`user_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`identity_id`) REFERENCES `user_git_identities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_folder_git_identity_unique` ON `folder_git_identity_bindings` (`folder_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_folder_git_identity_user` ON `folder_git_identity_bindings` (`user_id`);--> statement-breakpoint
CREATE TABLE `outline_digests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`period_key` text NOT NULL,
	`time_zone` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`counts_json` text NOT NULL,
	`item_count` integer DEFAULT 0 NOT NULL,
	`items_json` text NOT NULL,
	`ranges_json` text NOT NULL,
	`truncated` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`seen_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_outline_digests_user_period` ON `outline_digests` (`user_id`,`kind`,`period_key`);--> statement-breakpoint
CREATE INDEX `idx_outline_digests_unseen` ON `outline_digests` (`user_id`) WHERE "seen_at" IS NULL;--> statement-breakpoint
CREATE TABLE `outline_questions` (
	`block_id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`state` text NOT NULL,
	`proceed` integer DEFAULT false NOT NULL,
	`to_user_id` text,
	`asker_narrator_id` text,
	`asker_user_id` text,
	`asker_tool_call_id` text,
	`created_at` text NOT NULL,
	`answered_at` text,
	`answer_commit_id` text,
	`delivered_at` text,
	FOREIGN KEY (`block_id`) REFERENCES `outline_blocks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_outline_questions_to_open` ON `outline_questions` (`to_user_id`) WHERE "state" = 'open';--> statement-breakpoint
CREATE INDEX `idx_outline_questions_space_open` ON `outline_questions` (`space_id`) WHERE "state" = 'open';--> statement-breakpoint
CREATE INDEX `idx_outline_questions_asker_open` ON `outline_questions` (`asker_narrator_id`) WHERE "state" = 'open';--> statement-breakpoint
CREATE INDEX `idx_outline_questions_undelivered` ON `outline_questions` (`answered_at`) WHERE "state" = 'answered' AND "delivered_at" IS NULL;--> statement-breakpoint
CREATE TABLE `outline_spec_imports` (
	`narrator_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`trigger` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error_code` text,
	`last_error_count` integer,
	`last_error_detail` text,
	`attention_reason` text,
	`switch_count` integer DEFAULT 0 NOT NULL,
	`switched_at` text,
	`notice_switch` integer DEFAULT 0 NOT NULL,
	`space_id` text,
	`task_page_id` text,
	`fence_revision_id` text,
	`tasks` integer,
	`pages` integer,
	`revert_count` integer DEFAULT 0 NOT NULL,
	`reverted_at` text,
	`reverted_by` text,
	`revert_source_key` text,
	`revert_note_ids` text,
	`last_actor` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_outline_spec_imports_status` ON `outline_spec_imports` (`status`,`updated_at`,`narrator_id`);--> statement-breakpoint
CREATE TABLE `outline_spec_loss_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`path` text NOT NULL,
	`before_revision_id` text NOT NULL,
	`after_revision_id` text NOT NULL,
	`before_at` text,
	`saved_at` text,
	`kinds` text NOT NULL,
	`items` integer DEFAULT 0 NOT NULL,
	`excerpt` text NOT NULL,
	`truncated` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`block_id` text,
	`attach_note` text,
	`attach_seq` integer DEFAULT 0 NOT NULL,
	`attach_attempts` integer DEFAULT 0 NOT NULL,
	`inherited` integer DEFAULT 0 NOT NULL,
	`resolved_by` text,
	`resolved_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_outline_spec_loss_findings_status` ON `outline_spec_loss_findings` (`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_outline_spec_loss_findings_narrator` ON `outline_spec_loss_findings` (`narrator_id`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `outline_spec_loss_scans` (
	`narrator_id` text PRIMARY KEY NOT NULL,
	`source_key` text NOT NULL,
	`saves` integer DEFAULT 0 NOT NULL,
	`findings` integer DEFAULT 0 NOT NULL,
	`note` text,
	`scanned_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `outline_task_seen` (
	`user_id` text NOT NULL,
	`task_block_id` text NOT NULL,
	`seen_seq` integer NOT NULL,
	`seen_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `task_block_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_block_id`) REFERENCES `outline_blocks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_outline_task_seen_block` ON `outline_task_seen` (`task_block_id`);--> statement-breakpoint
CREATE INDEX `idx_outline_task_seen_user_at` ON `outline_task_seen` (`user_id`,`seen_at`);--> statement-breakpoint
CREATE TABLE `recent_tab_archive_marks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`narrator_id` text NOT NULL,
	`folder_id` text,
	`archived_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_recent_tab_archive_mark` ON `recent_tab_archive_marks` (`user_id`,`narrator_id`);--> statement-breakpoint
CREATE TABLE `usage_daily` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`billing_user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`provider` text NOT NULL,
	`credential_id` text NOT NULL,
	`model` text NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cached_input_tokens` integer DEFAULT 0 NOT NULL,
	`cache_creation_tokens` integer DEFAULT 0 NOT NULL,
	`reasoning_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`unpriced_request_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_usage_daily_key` ON `usage_daily` (`day`,`billing_user_id`,`project_id`,`provider`,`credential_id`,`model`);--> statement-breakpoint
ALTER TABLE `api_requests` ADD `billing_user_id` text;--> statement-breakpoint
ALTER TABLE `api_requests` ADD `project_id` text;--> statement-breakpoint
ALTER TABLE `api_requests` ADD `cache_usage_reported` integer;--> statement-breakpoint
ALTER TABLE `api_requests` ADD `decode_ms` integer;--> statement-breakpoint
ALTER TABLE `knowledge_submissions` ADD `author_read_at` text;--> statement-breakpoint
CREATE INDEX `idx_ks_submitter_author_read` ON `knowledge_submissions` (`submitter_user_id`,`author_read_at`);--> statement-breakpoint
ALTER TABLE `narrators` ADD `question_reflection_override` text DEFAULT 'inherit' NOT NULL;--> statement-breakpoint
ALTER TABLE `narrators` ADD `workspace_directories` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_narrators_status` ON `narrators` (`status`);--> statement-breakpoint
CREATE INDEX `idx_narrators_variant_list` ON `narrators` (`variant`,`hidden_from_lists`,`status`,`updated_at`,`id`);--> statement-breakpoint
ALTER TABLE `outline_block_versions` ADD `ask_json` text;--> statement-breakpoint
ALTER TABLE `outline_blocks` ADD `ask_json` text;--> statement-breakpoint
CREATE INDEX `idx_outline_blocks_active_tasks` ON `outline_blocks` (`space_id`) WHERE "deleted" = 0 AND (json_extract("task_json", '$.status') = 'doing' OR (json_extract("task_json", '$.status') = 'todo' AND json_extract("task_json", '$.lock') IS NOT NULL));--> statement-breakpoint
CREATE INDEX `idx_outline_blocks_finished_tasks` ON `outline_blocks` (`space_id`,`version_seq`,`id`) WHERE json_extract("task_json", '$.status') IN ('done', 'cancelled') AND "deleted" = 0;--> statement-breakpoint
ALTER TABLE `outline_pending` ADD `digest_seen_at` text;--> statement-breakpoint
CREATE INDEX `idx_outline_pending_digest` ON `outline_pending` (`decider_user_id`) WHERE "status" = 'confirmed' AND "digest_seen_at" IS NULL AND json_extract("decided_by_json", '$.kind') = 'agent';--> statement-breakpoint
ALTER TABLE `outline_spaces` ADD `last_commit_at` text;--> statement-breakpoint
CREATE INDEX `idx_outline_spaces_last_commit` ON `outline_spaces` (`last_commit_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_outline_spaces_unstamped` ON `outline_spaces` (`id`) WHERE "last_commit_at" IS NULL AND "next_seq" > 1;--> statement-breakpoint
ALTER TABLE `outline_view_state` ADD `expanded_json` text;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `compact_auxiliary_content` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `appearance_preferences` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `narrator_line_height_v2_percent` integer;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `recent_tabs_show_directory` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `git_identity_folder_context_menu` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `hidden_plugin_overlays` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `outline_digest_time_zone` text;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `outline_digest_time` text;--> statement-breakpoint
ALTER TABLE `user_recent_tabs` ADD `folder_id` text;--> statement-breakpoint
ALTER TABLE `user_recent_tabs` ADD `folder_icon` text;--> statement-breakpoint
ALTER TABLE `user_recent_tabs` ADD `folder_color` text;--> statement-breakpoint
ALTER TABLE `user_recent_tabs` ADD `folder_preview_count` integer;--> statement-breakpoint
CREATE INDEX `idx_user_recent_tabs_user_folder` ON `user_recent_tabs` (`user_id`,`folder_id`,`sort_order`);--> statement-breakpoint
ALTER TABLE `user_recent_tabs_meta` ADD `folders_migrated` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `workspaces` ADD `title_source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `workspaces` ADD `title_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_workspace_panels_kind_workspace` ON `workspace_panels` (`kind`,`workspace_id`,`id`);