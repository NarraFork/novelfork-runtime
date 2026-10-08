CREATE TABLE `api_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text,
	`message_id` text,
	`kind` text DEFAULT 'narrator' NOT NULL,
	`provider` text,
	`credential_id` text,
	`model` text,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cached_input_tokens` integer DEFAULT 0 NOT NULL,
	`cache_creation_input_tokens` integer DEFAULT 0 NOT NULL,
	`cache_creation_5m_tokens` integer DEFAULT 0 NOT NULL,
	`cache_creation_1h_tokens` integer DEFAULT 0 NOT NULL,
	`reasoning_tokens` integer DEFAULT 0 NOT NULL,
	`ttft_ms` integer,
	`duration_ms` integer,
	`cost_usd` real,
	`context_percent` real,
	`meter_usage` real,
	`meter_unit` text,
	`error_message` text,
	`raw_dump_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `narrator_messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_api_requests_narrator` ON `api_requests` (`narrator_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_api_requests_message` ON `api_requests` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_api_requests_provider` ON `api_requests` (`provider`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_api_requests_kind` ON `api_requests` (`kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_api_requests_created` ON `api_requests` (`created_at`);--> statement-breakpoint
CREATE TABLE `background_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_narrator_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`command` text,
	`exit_code` integer,
	`subagent_narrator_id` text,
	`subagent_type` text,
	`tool_use_id` text,
	`alias` text,
	`title` text,
	`output` text,
	`output_bytes` integer DEFAULT 0 NOT NULL,
	`output_truncated` integer DEFAULT false NOT NULL,
	`notified` integer DEFAULT false NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`parent_narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subagent_narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bg_tasks_parent` ON `background_tasks` (`parent_narrator_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_bg_tasks_subagent` ON `background_tasks` (`subagent_narrator_id`);--> statement-breakpoint
CREATE TABLE `benchmark_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`suite_id` text NOT NULL,
	`name` text NOT NULL,
	`model` text NOT NULL,
	`system_prompt` text,
	`permission_mode` text DEFAULT 'bypassPermissions',
	`status` text DEFAULT 'pending' NOT NULL,
	`config` text,
	`total_tasks` integer DEFAULT 0,
	`completed_tasks` integer DEFAULT 0,
	`passed_tasks` integer DEFAULT 0,
	`failed_tasks` integer DEFAULT 0,
	`total_cost_usd` real DEFAULT 0,
	`total_tokens_in` integer DEFAULT 0,
	`total_tokens_out` integer DEFAULT 0,
	`total_duration_ms` integer DEFAULT 0,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`suite_id`) REFERENCES `benchmark_suites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `benchmark_suites` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`version` text,
	`description` text,
	`tasks_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `benchmark_task_results` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`task_id` text NOT NULL,
	`task_name` text NOT NULL,
	`narrator_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`score` real,
	`max_score` real,
	`output` text,
	`eval_output` text,
	`error_message` text,
	`tokens_in` integer DEFAULT 0,
	`tokens_out` integer DEFAULT 0,
	`cost_usd` real DEFAULT 0,
	`duration_ms` integer DEFAULT 0,
	`tool_call_count` integer DEFAULT 0,
	`message_count` integer DEFAULT 0,
	`metadata` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `benchmark_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_task_results_run` ON `benchmark_task_results` (`run_id`,`status`);--> statement-breakpoint
CREATE TABLE `chapter_commits` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`sha` text NOT NULL,
	`message` text NOT NULL,
	`full_message` text,
	`author_name` text,
	`author_email` text,
	`authored_at` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`narrator_id` text,
	`narrator_message_id` text,
	`files_changed` integer,
	`lines_added` integer,
	`lines_removed` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`narrator_message_id`) REFERENCES `narrator_messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chapter_commits_sha` ON `chapter_commits` (`chapter_id`,`sha`);--> statement-breakpoint
CREATE INDEX `idx_chapter_commits_chapter` ON `chapter_commits` (`chapter_id`,`authored_at`);--> statement-breakpoint
CREATE INDEX `idx_chapter_commits_narrator` ON `chapter_commits` (`narrator_id`);--> statement-breakpoint
CREATE TABLE `chapter_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`type` text NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chapter_edges_src_tgt_type` ON `chapter_edges` (`source_id`,`target_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_chapter_edges_project` ON `chapter_edges` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_chapter_edges_source` ON `chapter_edges` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_chapter_edges_target` ON `chapter_edges` (`target_id`);--> statement-breakpoint
CREATE TABLE `chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`role` text DEFAULT 'branch' NOT NULL,
	`branch` text NOT NULL,
	`worktree_path` text,
	`base_branch` text NOT NULL,
	`parent_chapter_id` text,
	`fork_point` text,
	`merged_into_chapter_id` text,
	`merge_commit_sha` text,
	`merge_strategy` text,
	`pre_merge_target_sha` text,
	`container_config` text,
	`exploration_group_id` text,
	`is_root` integer DEFAULT 0,
	`head_commit_sha` text,
	`start_commit_sha` text,
	`commit_count` integer DEFAULT 0,
	`color` text,
	`group_label` text,
	`pinned` integer DEFAULT 0,
	`anchor_commit_sha` text,
	`axis_offset` real DEFAULT 0,
	`cross_offset` real DEFAULT 0,
	`panel_expanded` integer DEFAULT 0,
	`panel_width` real,
	`panel_height` real,
	`review_source_chapter_id` text,
	`review_status` text,
	`last_accessed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`merged_into_chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`exploration_group_id`) REFERENCES `exploration_groups`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`review_source_chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_chapters_project` ON `chapters` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_chapters_parent` ON `chapters` (`parent_chapter_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chapters_project_branch` ON `chapters` (`project_id`,`branch`);--> statement-breakpoint
CREATE TABLE `chat_group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`member_type` text NOT NULL,
	`user_id` text,
	`narrator_id` text,
	`role` text DEFAULT 'participant' NOT NULL,
	`can_control` integer DEFAULT false NOT NULL,
	`joined_at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `chat_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chat_group_members_group` ON `chat_group_members` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_group_members_narrator` ON `chat_group_members` (`narrator_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chat_group_members_group_narrator` ON `chat_group_members` (`group_id`,`narrator_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chat_group_members_group_user` ON `chat_group_members` (`group_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `chat_group_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`sender_type` text NOT NULL,
	`sender_user_id` text,
	`sender_narrator_id` text,
	`content` text NOT NULL,
	`urgent` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `chat_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sender_narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_chat_group_messages_group` ON `chat_group_messages` (`group_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `chat_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`origin_narrator_id` text,
	`project_id` text,
	`created_by` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`origin_narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_chat_groups_origin` ON `chat_groups` (`origin_narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_groups_project` ON `chat_groups` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_groups_status` ON `chat_groups` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `container_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`container_id` text,
	`service_name` text NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`host_port` integer,
	`container_port` integer,
	`proxy_label` text,
	`container_ip` text,
	`volume_name` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exploration_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`base_chapter_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`decided_chapter_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`base_chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`decided_chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `file_attributions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_path` text NOT NULL,
	`file_path` text NOT NULL,
	`narrator_id` text,
	`subagent_type` text,
	`action` text NOT NULL,
	`tool_name` text,
	`tool_use_id` text,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_file_attr_workspace_file` ON `file_attributions` (`workspace_path`,`file_path`,`changed_at`);--> statement-breakpoint
CREATE INDEX `idx_file_attr_narrator` ON `file_attributions` (`narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_file_attr_workspace` ON `file_attributions` (`workspace_path`,`changed_at`);--> statement-breakpoint
CREATE TABLE `gateway_session_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`chat_id` text NOT NULL,
	`user_id` text NOT NULL,
	`username` text,
	`narrator_id` text NOT NULL,
	`app_user_id` text,
	`project_id` text,
	`chapter_id` text,
	`last_message_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`app_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_gsm_platform_chat_user` ON `gateway_session_mappings` (`platform`,`chat_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_gsm_narrator` ON `gateway_session_mappings` (`narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_gsm_app_user` ON `gateway_session_mappings` (`app_user_id`);--> statement-breakpoint
CREATE TABLE `hooks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`event` text NOT NULL,
	`matcher` text DEFAULT '' NOT NULL,
	`type` text NOT NULL,
	`command` text,
	`url` text,
	`headers` text,
	`proxy_mode` text,
	`proxy_url` text,
	`prompt` text,
	`model` text,
	`timeout` integer DEFAULT 30 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_hooks_project` ON `hooks` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_hooks_event` ON `hooks` (`event`,`enabled`);--> statement-breakpoint
CREATE TABLE `knowledge_collections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`project_id` text,
	`default_level` text DEFAULT 'public' NOT NULL,
	`classification_level` text,
	`controlled_tags_json` text,
	`owner_user_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_kc_project_slug` ON `knowledge_collections` (`project_id`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_kc_project` ON `knowledge_collections` (`project_id`);--> statement-breakpoint
CREATE TABLE `knowledge_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text,
	`author_user_id` text NOT NULL,
	`name` text,
	`title` text,
	`target_collection_id` text,
	`base_revision_id` text,
	`keywords_json` text,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`format` text DEFAULT 'markdown' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `knowledge_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_collection_id`) REFERENCES `knowledge_collections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_kd_entry_author` ON `knowledge_drafts` (`entry_id`,`author_user_id`);--> statement-breakpoint
CREATE INDEX `idx_kd_entry` ON `knowledge_drafts` (`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_kd_author` ON `knowledge_drafts` (`author_user_id`);--> statement-breakpoint
CREATE TABLE `knowledge_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`current_revision_id` text,
	`current_content` text,
	`current_keywords` text,
	`tags_json` text,
	`keywords_json` text,
	`metadata_json` text,
	`classification_level` text,
	`controlled_tags_json` text,
	`review_tags_json` text,
	`owner_user_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `knowledge_collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ke_collection_slug` ON `knowledge_entries` (`collection_id`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_ke_collection` ON `knowledge_entries` (`collection_id`);--> statement-breakpoint
CREATE INDEX `idx_ke_status` ON `knowledge_entries` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ke_collection_updated` ON `knowledge_entries` (`collection_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `knowledge_entry_links` (
	`id` text PRIMARY KEY NOT NULL,
	`from_entry_id` text NOT NULL,
	`to_entry_id` text NOT NULL,
	`link_type` text NOT NULL,
	`label` text,
	`to_revision_id` text,
	`created_by_user_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`from_entry_id`) REFERENCES `knowledge_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_entry_id`) REFERENCES `knowledge_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_revision_id`) REFERENCES `knowledge_revisions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_kelink_entry_from_to_type` ON `knowledge_entry_links` (`from_entry_id`,`to_entry_id`,`link_type`);--> statement-breakpoint
CREATE INDEX `idx_kelink_from` ON `knowledge_entry_links` (`from_entry_id`);--> statement-breakpoint
CREATE INDEX `idx_kelink_to` ON `knowledge_entry_links` (`to_entry_id`);--> statement-breakpoint
CREATE TABLE `knowledge_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text,
	`principal_type` text NOT NULL,
	`principal_id` text NOT NULL,
	`grant_type` text NOT NULL,
	`clearance_level` text,
	`tag_id` text,
	`can_write` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `knowledge_collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `knowledge_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_kgrant_principal` ON `knowledge_grants` (`principal_type`,`principal_id`);--> statement-breakpoint
CREATE INDEX `idx_kgrant_tag` ON `knowledge_grants` (`tag_id`);--> statement-breakpoint
CREATE TABLE `knowledge_injection_events` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`compact_seq` integer NOT NULL,
	`entry_id` text NOT NULL,
	`entry_revision_id` text,
	`source` text NOT NULL,
	`trigger_message_id` text,
	`trigger_tool_call_id` text,
	`summary` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `knowledge_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_revision_id`) REFERENCES `knowledge_revisions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`trigger_message_id`) REFERENCES `narrator_messages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`trigger_tool_call_id`) REFERENCES `narrator_tool_calls`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_kie_cycle_entry` ON `knowledge_injection_events` (`narrator_id`,`compact_seq`,`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_kie_narrator_cycle` ON `knowledge_injection_events` (`narrator_id`,`compact_seq`);--> statement-breakpoint
CREATE INDEX `idx_kie_entry` ON `knowledge_injection_events` (`entry_id`);--> statement-breakpoint
CREATE TABLE `knowledge_levels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`rank` integer NOT NULL,
	`label` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_levels_name_unique` ON `knowledge_levels` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_klevel_rank` ON `knowledge_levels` (`rank`);--> statement-breakpoint
CREATE TABLE `knowledge_pack_activations` (
	`id` text PRIMARY KEY NOT NULL,
	`pack_id` text NOT NULL,
	`narrator_id` text NOT NULL,
	`extract_dir` text NOT NULL,
	`whitelist_dir_id` text,
	`archive_hash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`released_at` text,
	FOREIGN KEY (`pack_id`) REFERENCES `knowledge_packs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_kpackact_narrator` ON `knowledge_pack_activations` (`narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_kpackact_pack` ON `knowledge_pack_activations` (`pack_id`);--> statement-breakpoint
CREATE INDEX `idx_kpackact_narrator_pack_status` ON `knowledge_pack_activations` (`narrator_id`,`pack_id`,`status`);--> statement-breakpoint
CREATE TABLE `knowledge_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`project_id` text,
	`entry_id` text,
	`classification_level` text,
	`controlled_tags_json` text,
	`owner_user_id` text,
	`archive_format` text NOT NULL,
	`archive_size` integer NOT NULL,
	`archive_hash` text NOT NULL,
	`uncompressed_size` integer,
	`manifest_json` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`entry_id`) REFERENCES `knowledge_entries`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_kpack_project_slug` ON `knowledge_packs` (`project_id`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_kpack_project` ON `knowledge_packs` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_kpack_entry` ON `knowledge_packs` (`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_kpack_status` ON `knowledge_packs` (`status`);--> statement-breakpoint
CREATE TABLE `knowledge_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`version` integer NOT NULL,
	`format` text DEFAULT 'markdown' NOT NULL,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`change_note` text,
	`author_user_id` text,
	`base_revision_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `knowledge_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_kr_entry_version` ON `knowledge_revisions` (`entry_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_kr_entry` ON `knowledge_revisions` (`entry_id`);--> statement-breakpoint
CREATE TABLE `knowledge_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`entry_id` text,
	`collection_id` text,
	`title` text,
	`submitter_user_id` text NOT NULL,
	`base_revision_id` text,
	`proposed_content` text NOT NULL,
	`keywords_json` text,
	`change_note` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewer_user_id` text,
	`verdict` text,
	`findings_json` text,
	`reviewed_at` text,
	`merged_revision_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `knowledge_drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `knowledge_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_id`) REFERENCES `knowledge_collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submitter_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_ks_entry` ON `knowledge_submissions` (`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_ks_status` ON `knowledge_submissions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ks_submitter` ON `knowledge_submissions` (`submitter_user_id`);--> statement-breakpoint
CREATE INDEX `idx_ks_entry_created` ON `knowledge_submissions` (`entry_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ks_status_created` ON `knowledge_submissions` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `knowledge_tag_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`builtin` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_tag_types_name_unique` ON `knowledge_tag_types` (`name`);--> statement-breakpoint
CREATE INDEX `idx_ktagtype_sort` ON `knowledge_tag_types` (`sort_order`);--> statement-breakpoint
CREATE TABLE `knowledge_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text,
	`type_id` text,
	`name` text NOT NULL,
	`controlled` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `knowledge_collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`type_id`) REFERENCES `knowledge_tag_types`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ktag_collection_name` ON `knowledge_tags` (`collection_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_ktag_controlled` ON `knowledge_tags` (`controlled`);--> statement-breakpoint
CREATE INDEX `idx_ktag_type` ON `knowledge_tags` (`type_id`);--> statement-breakpoint
CREATE TABLE `merge_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`target_chapter_id` text NOT NULL,
	`source_chapter_ids` text NOT NULL,
	`strategy` text DEFAULT 'merge' NOT NULL,
	`status` text NOT NULL,
	`current_index` integer DEFAULT 0 NOT NULL,
	`merged_count` integer DEFAULT 0 NOT NULL,
	`current_source_chapter_id` text,
	`conflict_files` text,
	`error` text,
	`locale` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`target_chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `narrator_blacklist_cmds` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`pattern` text NOT NULL,
	`deny_prompt` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_blacklist_cmds_narrator` ON `narrator_blacklist_cmds` (`narrator_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_blacklist_cmds_narrator_pattern` ON `narrator_blacklist_cmds` (`narrator_id`,`pattern`);--> statement-breakpoint
CREATE TABLE `narrator_blacklist_dirs` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`path` text NOT NULL,
	`deny_level` text DEFAULT 'denyAll' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_blacklist_dirs_narrator` ON `narrator_blacklist_dirs` (`narrator_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_blacklist_dirs_narrator_path` ON `narrator_blacklist_dirs` (`narrator_id`,`path`);--> statement-breakpoint
CREATE TABLE `narrator_buffered_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`text` text NOT NULL,
	`images_json` text,
	`command_text` text,
	`bash_command` text,
	`created_by` text,
	`creator_json` text,
	`text_file_paths_json` text,
	`priority` integer DEFAULT false NOT NULL,
	`seq` integer NOT NULL,
	`buffered_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_nbm_narrator_seq` ON `narrator_buffered_messages` (`narrator_id`,`seq`);--> statement-breakpoint
CREATE TABLE `narrator_file_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`file_path` text NOT NULL,
	`original_content` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_file_snapshots_narrator` ON `narrator_file_snapshots` (`narrator_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_file_snapshots_narrator_file` ON `narrator_file_snapshots` (`narrator_id`,`file_path`);--> statement-breakpoint
CREATE TABLE `narrator_message_refs` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`message_id` text NOT NULL,
	`seq` integer NOT NULL,
	`is_compact` integer DEFAULT 0 NOT NULL,
	`pruned_percent` integer,
	`segment_compact_id` text,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`message_id`) REFERENCES `narrator_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_narrator_refs_unique` ON `narrator_message_refs` (`narrator_id`,`message_id`);--> statement-breakpoint
CREATE INDEX `idx_narrator_refs_seq` ON `narrator_message_refs` (`narrator_id`,`seq`);--> statement-breakpoint
CREATE INDEX `idx_narrator_refs_compact_seq` ON `narrator_message_refs` (`narrator_id`,`is_compact`,`seq`);--> statement-breakpoint
CREATE INDEX `idx_narrator_refs_message` ON `narrator_message_refs` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_narrator_refs_segment_compact` ON `narrator_message_refs` (`segment_compact_id`);--> statement-breakpoint
CREATE TABLE `narrator_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`sdk_message_uuid` text,
	`parent_tool_use_id` text,
	`role` text NOT NULL,
	`content_json` text NOT NULL,
	`content_text` text,
	`tokens_in` integer,
	`cost_usd` real,
	`turn_usage_json` text,
	`provider` text,
	`credential_id` text,
	`model` text,
	`output_tokens` integer,
	`cached_input_tokens` integer,
	`cache_creation_input_tokens` integer,
	`cache_creation_5m_tokens` integer,
	`cache_creation_1h_tokens` integer,
	`reasoning_tokens` integer,
	`ttft_ms` integer,
	`duration_ms` integer,
	`context_percent` real,
	`meter_usage` real,
	`meter_unit` text,
	`commit_sha` text,
	`command_text` text,
	`created_by` text,
	`edited_at` text,
	`edited_by` text,
	`original_content_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`edited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_messages_narrator` ON `narrator_messages` (`narrator_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_messages_parent_tool_use_lookup` ON `narrator_messages` (`parent_tool_use_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_parent_tool_use` ON `narrator_messages` (`narrator_id`,`parent_tool_use_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_toplevel` ON `narrator_messages` (`narrator_id`,`parent_tool_use_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `narrator_patches` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`message_id` text NOT NULL,
	`tool_use_id` text NOT NULL,
	`before_hash` text NOT NULL,
	`after_hash` text NOT NULL,
	`files_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `narrator_messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_patches_narrator` ON `narrator_patches` (`narrator_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_patches_message` ON `narrator_patches` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_patches_tool_use` ON `narrator_patches` (`tool_use_id`);--> statement-breakpoint
CREATE TABLE `narrator_sidecars` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`message_id` text,
	`tool_use_id` text,
	`target` text NOT NULL,
	`source` text NOT NULL,
	`content` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `narrator_messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sidecars_message` ON `narrator_sidecars` (`message_id`,`target`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_sidecars_tool_use` ON `narrator_sidecars` (`tool_use_id`,`target`,`order_index`);--> statement-breakpoint
CREATE INDEX `idx_sidecars_narrator` ON `narrator_sidecars` (`narrator_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `narrator_tool_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`message_id` text NOT NULL,
	`tool_use_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`input_json` text,
	`output_json` text,
	`status` text DEFAULT 'initializing' NOT NULL,
	`duration_ms` integer,
	`stream_started_at` text,
	`permission_started_at` text,
	`execution_started_at` text,
	`completed_at` text,
	`error_message` text,
	`permission_decided_by` text,
	`permission_decided_at` text,
	`permission_deny_message` text,
	`permission_decision_reason` text,
	`permission_suggestions` text,
	`is_background` integer DEFAULT false NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cache_creation_tokens` integer DEFAULT 0 NOT NULL,
	`cache_read_tokens` integer DEFAULT 0 NOT NULL,
	`cache_creation_5m_tokens` integer DEFAULT 0 NOT NULL,
	`cache_creation_1h_tokens` integer DEFAULT 0 NOT NULL,
	`input_cost` real DEFAULT 0 NOT NULL,
	`output_cost` real DEFAULT 0 NOT NULL,
	`cache_creation_cost` real DEFAULT 0 NOT NULL,
	`cache_read_cost` real DEFAULT 0 NOT NULL,
	`total_cost` real DEFAULT 0 NOT NULL,
	`provider` text,
	`model` text,
	`result_message_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`message_id`) REFERENCES `narrator_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_toolcalls_message` ON `narrator_tool_calls` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_toolcalls_tool_use_id` ON `narrator_tool_calls` (`tool_use_id`);--> statement-breakpoint
CREATE INDEX `idx_toolcalls_status` ON `narrator_tool_calls` (`narrator_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_toolcalls_status_narrator_created` ON `narrator_tool_calls` (`status`,`narrator_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_toolcalls_created` ON `narrator_tool_calls` (`narrator_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `narrator_whitelist_cmds` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`pattern` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_whitelist_cmds_narrator` ON `narrator_whitelist_cmds` (`narrator_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_whitelist_cmds_narrator_pattern` ON `narrator_whitelist_cmds` (`narrator_id`,`pattern`);--> statement-breakpoint
CREATE TABLE `narrator_whitelist_dirs` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`path` text NOT NULL,
	`access_level` text DEFAULT 'readOnly' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_whitelist_dirs_narrator` ON `narrator_whitelist_dirs` (`narrator_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_whitelist_dirs_narrator_path` ON `narrator_whitelist_dirs` (`narrator_id`,`path`);--> statement-breakpoint
CREATE TABLE `narrators` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text,
	`api_conversation_id` text,
	`fork_message_id` text,
	`type` text DEFAULT 'primary' NOT NULL,
	`subagent_type` text,
	`title` text,
	`inherit_mode` text DEFAULT 'fresh' NOT NULL,
	`parent_narrator_id` text,
	`context_summary` text,
	`model` text DEFAULT 'claude-sonnet-4.5',
	`pending_model_restore` text,
	`system_prompt` text,
	`permission_mode` text DEFAULT 'default',
	`previous_permission_mode` text,
	`plan_file_id` text,
	`reasoning_effort` text,
	`fast_mode` integer DEFAULT false NOT NULL,
	`relaxed_plan` integer DEFAULT false NOT NULL,
	`plan_reflection_auto_approve_override` text DEFAULT 'inherit' NOT NULL,
	`danger_reflection_override` text DEFAULT 'inherit' NOT NULL,
	`auto_continuation_override` text DEFAULT 'inherit' NOT NULL,
	`behavior_fence_interval_override` integer,
	`tasks_reminder_interval_override` integer,
	`behavior_fence_attach_override` text DEFAULT 'inherit' NOT NULL,
	`message_count` integer DEFAULT 0,
	`total_cost_usd` real DEFAULT 0,
	`last_message_at` text,
	`status` text DEFAULT 'idle' NOT NULL,
	`substatus` text DEFAULT '[]' NOT NULL,
	`plan_mode` integer DEFAULT false NOT NULL,
	`cwd` text,
	`error_message` text,
	`prune_boundary_message_id` text,
	`pruned_percent` integer,
	`prune_enabled` integer DEFAULT true NOT NULL,
	`enabled_tools` text,
	`variant` text DEFAULT 'primary' NOT NULL,
	`traits` text DEFAULT '[]' NOT NULL,
	`handle` text,
	`is_background` integer DEFAULT false NOT NULL,
	`background_status` text,
	`background_result` text,
	`background_completed_at` text,
	`is_ask_in_passing` integer DEFAULT false NOT NULL,
	`turn_started_at` text,
	`message_version` integer DEFAULT 0 NOT NULL,
	`default_device_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fork_message_id`) REFERENCES `narrator_messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prune_boundary_message_id`) REFERENCES `narrator_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_narrators_chapter` ON `narrators` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_narrators_parent` ON `narrators` (`parent_narrator_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_narrators_handle` ON `narrators` (`handle`);--> statement-breakpoint
CREATE TABLE `port_allocations` (
	`port` integer PRIMARY KEY NOT NULL,
	`chapter_id` text,
	`service_name` text,
	`allocated_at` text NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`flow_mode` text DEFAULT 'classic' NOT NULL,
	`git_path` text,
	`remote_url` text,
	`default_branch` text DEFAULT 'main',
	`startup_script` text,
	`copy_files` text,
	`chapter_settings` text,
	`proxy_domain` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `remote_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`connection_mode` text DEFAULT 'reverse' NOT NULL,
	`direct_url` text,
	`status` text DEFAULT 'offline' NOT NULL,
	`last_seen_at` text,
	`platform_os` text,
	`platform_arch` text,
	`shell_path` text,
	`default_cwd` text,
	`agent_version` text,
	`capabilities_json` text,
	`scope` text DEFAULT 'global' NOT NULL,
	`project_id` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_remote_devices_slug` ON `remote_devices` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_remote_devices_status` ON `remote_devices` (`status`);--> statement-breakpoint
CREATE INDEX `idx_remote_devices_project` ON `remote_devices` (`project_id`);--> statement-breakpoint
CREATE TABLE `review_conclusions` (
	`id` text PRIMARY KEY NOT NULL,
	`review_chapter_id` text NOT NULL,
	`source_chapter_id` text NOT NULL,
	`verdict` text NOT NULL,
	`findings_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`review_chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_review_conclusions_review` ON `review_conclusions` (`review_chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_review_conclusions_source` ON `review_conclusions` (`source_chapter_id`);--> statement-breakpoint
CREATE TABLE `scheduled_task_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`narrator_id` text,
	`status` text NOT NULL,
	`error` text,
	`run_context` text NOT NULL,
	`manual` integer DEFAULT false NOT NULL,
	`started_at` text,
	`finished_at` text,
	`duration_ms` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `scheduled_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_scheduled_task_runs_task` ON `scheduled_task_runs` (`task_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_scheduled_task_runs_narrator` ON `scheduled_task_runs` (`narrator_id`);--> statement-breakpoint
CREATE TABLE `scheduled_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`cron_expr` text NOT NULL,
	`timezone` text,
	`prompt` text NOT NULL,
	`system_prompt` text,
	`model` text,
	`permission_mode` text DEFAULT 'bypassPermissions' NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`run_context` text DEFAULT 'standalone' NOT NULL,
	`cwd` text,
	`project_id` text,
	`chapter_id` text,
	`narrator_mode` text DEFAULT 'new' NOT NULL,
	`reuse_narrator_id` text,
	`created_by` text,
	`last_run_at` text,
	`next_run_at` text,
	`last_narrator_id` text,
	`last_status` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reuse_narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_scheduled_tasks_enabled` ON `scheduled_tasks` (`enabled`);--> statement-breakpoint
CREATE INDEX `idx_scheduled_tasks_next_run` ON `scheduled_tasks` (`enabled`,`next_run_at`);--> statement-breakpoint
CREATE INDEX `idx_scheduled_tasks_project` ON `scheduled_tasks` (`project_id`);--> statement-breakpoint
CREATE TABLE `skill_directory_caches` (
	`id` text PRIMARY KEY NOT NULL,
	`root_kind` text NOT NULL,
	`normalized_root_path` text NOT NULL,
	`skills_json` text NOT NULL,
	`signature_json` text NOT NULL,
	`scanned_at` text NOT NULL,
	`last_accessed_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_skill_dir_cache_root` ON `skill_directory_caches` (`root_kind`,`normalized_root_path`);--> statement-breakpoint
CREATE INDEX `idx_skill_dir_cache_last_accessed` ON `skill_directory_caches` (`last_accessed_at`);--> statement-breakpoint
CREATE INDEX `idx_skill_dir_cache_expires` ON `skill_directory_caches` (`expires_at`);--> statement-breakpoint
CREATE TABLE `spec_file_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace_id` text NOT NULL,
	`path` text NOT NULL,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`parent_revision_id` text,
	`source_tool_use_id` text,
	`source_message_id` text,
	`created_by` text DEFAULT 'assistant' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`namespace_id`) REFERENCES `spec_namespaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_revision_id`) REFERENCES `spec_file_revisions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_message_id`) REFERENCES `narrator_messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_spec_file_revisions_namespace_path` ON `spec_file_revisions` (`namespace_id`,`path`);--> statement-breakpoint
CREATE INDEX `idx_spec_file_revisions_parent` ON `spec_file_revisions` (`parent_revision_id`);--> statement-breakpoint
CREATE TABLE `spec_namespace_files` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace_id` text NOT NULL,
	`path` text NOT NULL,
	`revision_id` text,
	`deleted` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`namespace_id`) REFERENCES `spec_namespaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`revision_id`) REFERENCES `spec_file_revisions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_spec_namespace_files_namespace_path` ON `spec_namespace_files` (`namespace_id`,`path`);--> statement-breakpoint
CREATE INDEX `idx_spec_namespace_files_revision` ON `spec_namespace_files` (`revision_id`);--> statement-breakpoint
CREATE TABLE `spec_namespaces` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`forked_from_namespace_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`forked_from_namespace_id`) REFERENCES `spec_namespaces`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_spec_namespaces_narrator` ON `spec_namespaces` (`narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_spec_namespaces_forked_from` ON `spec_namespaces` (`forked_from_namespace_id`);--> statement-breakpoint
CREATE TABLE `spec_protected_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace_id` text NOT NULL,
	`text_hash` text NOT NULL,
	`text` text NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`first_revision_id` text,
	`last_revision_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	`deleted_at` text,
	FOREIGN KEY (`namespace_id`) REFERENCES `spec_namespaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`first_revision_id`) REFERENCES `spec_file_revisions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`last_revision_id`) REFERENCES `spec_file_revisions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_spec_protected_tasks_namespace_hash` ON `spec_protected_tasks` (`namespace_id`,`text_hash`);--> statement-breakpoint
CREATE INDEX `idx_spec_protected_tasks_namespace_status` ON `spec_protected_tasks` (`namespace_id`,`status`);--> statement-breakpoint
CREATE TABLE `terminal_tabs` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text,
	`narrator_id` text,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_terminal_tabs_chapter` ON `terminal_tabs` (`chapter_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_terminal_tabs_narrator` ON `terminal_tabs` (`narrator_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `terminal_view_state` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`chapter_id` text,
	`narrator_id` text,
	`layout` text DEFAULT 'single' NOT NULL,
	`active_tab_id` text,
	`panel_assignments` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_view_state_user_chapter` ON `terminal_view_state` (`user_id`,`chapter_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_view_state_user_narrator` ON `terminal_view_state` (`user_id`,`narrator_id`);--> statement-breakpoint
CREATE TABLE `terminals` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text,
	`narrator_id` text,
	`name` text NOT NULL,
	`cwd` text,
	`dtach_socket` text,
	`device_id` text,
	`status` text DEFAULT 'running' NOT NULL,
	`exit_code` integer,
	`graph_opened` integer DEFAULT 0 NOT NULL,
	`graph_x` real,
	`graph_y` real,
	`graph_width` real,
	`graph_height` real,
	`created_at` text NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_terminals_chapter` ON `terminals` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_terminals_narrator` ON `terminals` (`narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_terminals_status` ON `terminals` (`status`);--> statement-breakpoint
CREATE TABLE `user_favorite_directories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`path` text NOT NULL,
	`label` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_fav_dirs_user` ON `user_favorite_directories` (`user_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `user_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`subject` text NOT NULL,
	`email` text,
	`display_name` text,
	`last_login_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_identities_provider_subject` ON `user_identities` (`provider`,`subject`);--> statement-breakpoint
CREATE INDEX `idx_user_identities_user` ON `user_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_mfa_backup_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_mfa_backup_codes_user` ON `user_mfa_backup_codes` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_passkeys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`transports` text,
	`device_type` text,
	`backed_up` integer DEFAULT false NOT NULL,
	`name` text,
	`last_used_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_passkeys_credential` ON `user_passkeys` (`credential_id`);--> statement-breakpoint
CREATE INDEX `idx_passkeys_user` ON `user_passkeys` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`auto_load_older_messages` integer DEFAULT true NOT NULL,
	`fast_mode_default` integer DEFAULT false NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`word_wrap_markdown` integer DEFAULT true NOT NULL,
	`word_wrap_code` integer DEFAULT true NOT NULL,
	`word_wrap_diff` integer DEFAULT true NOT NULL,
	`reply_in_user_language` integer DEFAULT true NOT NULL,
	`show_token_usage` integer DEFAULT false NOT NULL,
	`show_output_stats` integer DEFAULT true NOT NULL,
	`terminal_theme` text DEFAULT 'auto' NOT NULL,
	`terminal_font_size` integer DEFAULT 14 NOT NULL,
	`recent_tabs` text DEFAULT '[]' NOT NULL,
	`add_subagent_to_recent_tabs` integer DEFAULT true NOT NULL,
	`notify_on_done` integer DEFAULT true NOT NULL,
	`notify_on_waiting` integer DEFAULT true NOT NULL,
	`notify_pwa_enabled` integer DEFAULT false NOT NULL,
	`notify_sound_enabled` integer DEFAULT true NOT NULL,
	`notify_sound_type` text DEFAULT 'builtin' NOT NULL,
	`notify_sound_builtin` text DEFAULT 'gentle' NOT NULL,
	`notify_sound_file_id` text,
	`notify_dingtalk_enabled` integer DEFAULT false NOT NULL,
	`notify_dingtalk_webhook` text DEFAULT '' NOT NULL,
	`notify_dingtalk_secret` text DEFAULT '' NOT NULL,
	`notify_feishu_enabled` integer DEFAULT false NOT NULL,
	`notify_feishu_webhook` text DEFAULT '' NOT NULL,
	`notify_feishu_secret` text DEFAULT '' NOT NULL,
	`commands` text DEFAULT '[]' NOT NULL,
	`graph_viewports` text DEFAULT '{}' NOT NULL,
	`queue_mode` text DEFAULT 'turn' NOT NULL,
	`ctrl_enter_queue_mode` text DEFAULT 'tool' NOT NULL,
	`setup_wizard_completed` integer DEFAULT false NOT NULL,
	`gateway_config` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_preferences_user_id_unique` ON `user_preferences` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_totp` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`secret` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`activated_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_totp_user` ON `user_totp` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`avatar_color` text,
	`avatar_image_id` text,
	`git_username` text,
	`git_email` text,
	`mfa_enabled` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `volume_snapshot_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`applied_at` text NOT NULL,
	`applied_by` text,
	FOREIGN KEY (`snapshot_id`) REFERENCES `volume_snapshots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`applied_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_snapshot_applications_snapshot` ON `volume_snapshot_applications` (`snapshot_id`);--> statement-breakpoint
CREATE INDEX `idx_snapshot_applications_chapter` ON `volume_snapshot_applications` (`chapter_id`);--> statement-breakpoint
CREATE TABLE `volume_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`source_chapter_id` text,
	`service_name` text NOT NULL,
	`container_path` text NOT NULL,
	`size_bytes` integer,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_volume_snapshots_project` ON `volume_snapshots` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_volume_snapshots_source_chapter` ON `volume_snapshots` (`source_chapter_id`);--> statement-breakpoint
CREATE TABLE `webauthn_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge` text NOT NULL,
	`type` text NOT NULL,
	`user_id` text,
	`expires_at` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_webauthn_challenge` ON `webauthn_challenges` (`challenge`);--> statement-breakpoint
CREATE INDEX `idx_webauthn_challenge_expires` ON `webauthn_challenges` (`expires_at`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`tree` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_workspaces_user` ON `workspaces` (`user_id`);