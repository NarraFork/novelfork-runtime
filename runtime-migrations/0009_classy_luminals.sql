ALTER TABLE `chapters` ADD `merge_snapshot_commit_sha` text;--> statement-breakpoint
ALTER TABLE `chapters` ADD `pre_merge_target_snapshot_sha` text;--> statement-breakpoint
ALTER TABLE `chapters` ADD `merged_source_snapshot_sha` text;--> statement-breakpoint
ALTER TABLE `chapters` ADD `snapshot_commit_sha` text;--> statement-breakpoint
ALTER TABLE `chapters` ADD `snapshot_shadow_key` text;--> statement-breakpoint
ALTER TABLE `chapters` ADD `dormant_snapshot_commit_sha` text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_chapters_snapshot_shadow_key` ON `chapters` (`snapshot_shadow_key`);--> statement-breakpoint
ALTER TABLE `merge_sessions` ADD `pre_merge_tree` text;--> statement-breakpoint
ALTER TABLE `merge_sessions` ADD `conflict_tree` text;--> statement-breakpoint
ALTER TABLE `merge_sessions` ADD `pre_merge_target_snapshot` text;--> statement-breakpoint
ALTER TABLE `merge_sessions` ADD `merge_source_snapshot` text;--> statement-breakpoint
ALTER TABLE `merge_sessions` ADD `pre_merge_target_sha` text;--> statement-breakpoint
ALTER TABLE `narrator_messages` ADD `snapshot_commit_sha` text;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `notify_sound_volume` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `notify_sound_max_concurrent` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `worktree_tree_snapshots` ADD `snapshot_commit_sha` text;