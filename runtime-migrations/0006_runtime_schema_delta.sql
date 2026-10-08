CREATE TABLE `credential_usage_totals` (
	`id` text PRIMARY KEY NOT NULL,
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
	`unpriced_request_count` integer DEFAULT 0 NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_credential_usage_totals_key` ON `credential_usage_totals` (`provider`,`credential_id`,`model`);
--> statement-breakpoint
CREATE INDEX `idx_credential_usage_totals_credential` ON `credential_usage_totals` (`provider`,`credential_id`);
--> statement-breakpoint
CREATE TABLE `worktree_tree_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text DEFAULT 'local' NOT NULL,
	`worktree_path` text NOT NULL,
	`tree_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_worktree_tree_snapshots_unique` ON `worktree_tree_snapshots` (`device_id`,`worktree_path`,`tree_hash`);
--> statement-breakpoint
CREATE INDEX `idx_worktree_tree_snapshots_path` ON `worktree_tree_snapshots` (`device_id`,`worktree_path`,`created_at`);
--> statement-breakpoint
ALTER TABLE `narrator_blacklist_cmds` ADD `target_kind` text;
--> statement-breakpoint
ALTER TABLE `narrator_blacklist_cmds` ADD `target_value` text;
--> statement-breakpoint
ALTER TABLE `narrator_blacklist_cmds` ADD `device_scope` text;
--> statement-breakpoint
ALTER TABLE `narrator_blacklist_cmds` ADD `updated_at` text;
--> statement-breakpoint
DROP INDEX `idx_blacklist_dirs_narrator_path`;
--> statement-breakpoint
ALTER TABLE `narrator_blacklist_dirs` ADD `path_flavor` text;
--> statement-breakpoint
ALTER TABLE `narrator_blacklist_dirs` ADD `path_key` text;
--> statement-breakpoint
ALTER TABLE `narrator_blacklist_dirs` ADD `target_kind` text;
--> statement-breakpoint
ALTER TABLE `narrator_blacklist_dirs` ADD `target_value` text;
--> statement-breakpoint
ALTER TABLE `narrator_blacklist_dirs` ADD `device_scope` text;
--> statement-breakpoint
ALTER TABLE `narrator_blacklist_dirs` ADD `updated_at` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_blacklist_dirs_narrator_path_unscoped` ON `narrator_blacklist_dirs` (`narrator_id`,`path`) WHERE "narrator_blacklist_dirs"."device_scope" is null;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_blacklist_dirs_narrator_path_scoped` ON `narrator_blacklist_dirs` (`narrator_id`,`path`,`device_scope`) WHERE "narrator_blacklist_dirs"."device_scope" is not null;
--> statement-breakpoint
DROP INDEX `idx_whitelist_cmds_narrator_pattern`;
--> statement-breakpoint
ALTER TABLE `narrator_whitelist_cmds` ADD `target_kind` text;
--> statement-breakpoint
ALTER TABLE `narrator_whitelist_cmds` ADD `target_value` text;
--> statement-breakpoint
ALTER TABLE `narrator_whitelist_cmds` ADD `device_scope` text;
--> statement-breakpoint
ALTER TABLE `narrator_whitelist_cmds` ADD `updated_at` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_whitelist_cmds_narrator_pattern_unscoped` ON `narrator_whitelist_cmds` (`narrator_id`,`pattern`) WHERE "narrator_whitelist_cmds"."device_scope" is null;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_whitelist_cmds_narrator_pattern_scoped` ON `narrator_whitelist_cmds` (`narrator_id`,`pattern`,`device_scope`) WHERE "narrator_whitelist_cmds"."device_scope" is not null;
--> statement-breakpoint
DROP INDEX `idx_whitelist_dirs_narrator_path`;
--> statement-breakpoint
ALTER TABLE `narrator_whitelist_dirs` ADD `path_flavor` text;
--> statement-breakpoint
ALTER TABLE `narrator_whitelist_dirs` ADD `path_key` text;
--> statement-breakpoint
ALTER TABLE `narrator_whitelist_dirs` ADD `target_kind` text;
--> statement-breakpoint
ALTER TABLE `narrator_whitelist_dirs` ADD `target_value` text;
--> statement-breakpoint
ALTER TABLE `narrator_whitelist_dirs` ADD `device_scope` text;
--> statement-breakpoint
ALTER TABLE `narrator_whitelist_dirs` ADD `updated_at` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_whitelist_dirs_narrator_path_unscoped` ON `narrator_whitelist_dirs` (`narrator_id`,`path`) WHERE "narrator_whitelist_dirs"."device_scope" is null;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_whitelist_dirs_narrator_path_scoped` ON `narrator_whitelist_dirs` (`narrator_id`,`path`,`device_scope`) WHERE "narrator_whitelist_dirs"."device_scope" is not null;
--> statement-breakpoint
ALTER TABLE `knowledge_submissions` ADD `previous_submission_id` text;
--> statement-breakpoint
ALTER TABLE `knowledge_submissions` ADD `round` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `narrator_file_snapshots` ADD `original_encoding` text;
--> statement-breakpoint
ALTER TABLE `narrator_file_snapshots` ADD `is_binary` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `narrator_messages` ADD `tree_hash_after` text;
--> statement-breakpoint
ALTER TABLE `narrator_messages` ADD `compact_pending` integer GENERATED ALWAYS AS ((CASE WHEN json_extract("content_json", '$[0].type') = 'compact' AND (json_extract("content_json", '$[0].status') IN ('compacting', 'running') OR json_extract("content_json", '$[0].attempts[#-1].status') = 'running') THEN 1 ELSE 0 END)) VIRTUAL;
--> statement-breakpoint
CREATE INDEX `idx_messages_compact_pending` ON `narrator_messages` (`compact_pending`) WHERE "compact_pending" = 1;
--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `execution_path_flavor` text;
--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `canonical_file_path` text;
--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `runtime_generation` integer;
--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `execution_targets_json` text;
--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `tree_hash_before` text;
--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `tree_hash_after` text;
--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `owned_paths_json` text;
--> statement-breakpoint
ALTER TABLE `narrators` ADD `error_retryable` integer;
--> statement-breakpoint
ALTER TABLE `narrators` ADD `refs_inherited_from` text REFERENCES narrators(id);
--> statement-breakpoint
ALTER TABLE `narrators` ADD `refs_backfill_cursor` integer;
--> statement-breakpoint
CREATE INDEX `idx_narrators_refs_inherited_from` ON `narrators` (`refs_inherited_from`) WHERE "refs_inherited_from" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_api_requests_credential` ON `api_requests` (`credential_id`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_kgrant_unique_scoped_tagged` ON `knowledge_grants` (`collection_id`,`principal_type`,`principal_id`,`grant_type`,`tag_id`) WHERE "knowledge_grants"."collection_id" is not null and "knowledge_grants"."tag_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_kgrant_unique_scoped_untagged` ON `knowledge_grants` (`collection_id`,`principal_type`,`principal_id`,`grant_type`) WHERE "knowledge_grants"."collection_id" is not null and "knowledge_grants"."tag_id" is null;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_kgrant_unique_global_tagged` ON `knowledge_grants` (`principal_type`,`principal_id`,`grant_type`,`tag_id`) WHERE "knowledge_grants"."collection_id" is null and "knowledge_grants"."tag_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_kgrant_unique_global_untagged` ON `knowledge_grants` (`principal_type`,`principal_id`,`grant_type`) WHERE "knowledge_grants"."collection_id" is null and "knowledge_grants"."tag_id" is null;
