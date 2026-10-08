CREATE TABLE `acl_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`actor_role` text,
	`event_type` text NOT NULL,
	`subject_type` text,
	`subject_id` text,
	`scope_type` text NOT NULL,
	`scope_id` text,
	`outcome` text NOT NULL,
	`detail_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_acl_event_created` ON `acl_events` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_acl_event_scope` ON `acl_events` (`scope_type`,`scope_id`);--> statement-breakpoint
CREATE INDEX `idx_acl_event_subject` ON `acl_events` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE INDEX `idx_acl_event_actor` ON `acl_events` (`actor_user_id`);--> statement-breakpoint
CREATE TABLE `acl_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text,
	`principal_type` text NOT NULL,
	`principal_id` text NOT NULL,
	`capability` text NOT NULL,
	`domain_kind` text,
	`domain_value` text,
	`granted_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_acl_grant_unique_scoped_domain` ON `acl_grants` (`scope_type`,`scope_id`,`principal_type`,`principal_id`,`capability`,`domain_kind`,`domain_value`) WHERE "acl_grants"."scope_id" is not null and "acl_grants"."domain_value" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_acl_grant_unique_scoped_capability` ON `acl_grants` (`scope_type`,`scope_id`,`principal_type`,`principal_id`,`capability`) WHERE "acl_grants"."scope_id" is not null and "acl_grants"."domain_value" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_acl_grant_unique_global_domain` ON `acl_grants` (`scope_type`,`principal_type`,`principal_id`,`capability`,`domain_kind`,`domain_value`) WHERE "acl_grants"."scope_id" is null and "acl_grants"."domain_value" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_acl_grant_unique_global_capability` ON `acl_grants` (`scope_type`,`principal_type`,`principal_id`,`capability`) WHERE "acl_grants"."scope_id" is null and "acl_grants"."domain_value" is null;--> statement-breakpoint
CREATE INDEX `idx_acl_grant_principal` ON `acl_grants` (`principal_type`,`principal_id`);--> statement-breakpoint
CREATE INDEX `idx_acl_grant_scope` ON `acl_grants` (`scope_type`,`scope_id`);--> statement-breakpoint
CREATE INDEX `idx_acl_grant_granted_by` ON `acl_grants` (`granted_by`);--> statement-breakpoint
CREATE TABLE `chat_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`message_id` text,
	`uploader_user_id` text,
	`kind` text NOT NULL,
	`filename` text NOT NULL,
	`media_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`stored_name` text NOT NULL,
	`created_at` text NOT NULL,
	`claimed_at` text,
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploader_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_chat_attachments_message` ON `chat_attachments` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_attachments_room_unclaimed` ON `chat_attachments` (`room_id`,`claimed_at`);--> statement-breakpoint
CREATE INDEX `idx_chat_attachments_uploader` ON `chat_attachments` (`uploader_user_id`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`seq` integer NOT NULL,
	`sender_user_id` text,
	`kind` text DEFAULT 'text' NOT NULL,
	`content_text` text NOT NULL,
	`reply_to_message_id` text,
	`reply_to_seq` integer,
	`reply_to_sender_user_id` text,
	`reply_to_preview` text,
	`edited_at` text,
	`deleted_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chat_messages_room_seq` ON `chat_messages` (`room_id`,`seq`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_sender` ON `chat_messages` (`sender_user_id`);--> statement-breakpoint
CREATE TABLE `chat_room_members` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`last_read_seq` integer DEFAULT 0 NOT NULL,
	`last_read_at` text,
	`muted` integer DEFAULT false NOT NULL,
	`joined_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chat_room_members_room_user` ON `chat_room_members` (`room_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_room_members_user_room` ON `chat_room_members` (`user_id`,`room_id`);--> statement-breakpoint
CREATE TABLE `chat_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`dm_key` text,
	`narrator_id` text,
	`next_seq` integer DEFAULT 1 NOT NULL,
	`last_message_at` text,
	`last_message_preview` text,
	`last_message_sender_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chat_rooms_dm_key` ON `chat_rooms` (`dm_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chat_rooms_narrator` ON `chat_rooms` (`narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_rooms_kind_last` ON `chat_rooms` (`kind`,`last_message_at`);--> statement-breakpoint
CREATE TABLE `knowledge_acl_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`actor_role` text,
	`event_type` text NOT NULL,
	`subject_type` text,
	`subject_id` text,
	`target_type` text,
	`target_id` text,
	`detail_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_kacl_events_created` ON `knowledge_acl_events` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_kacl_events_subject` ON `knowledge_acl_events` (`subject_type`,`subject_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_kacl_events_target` ON `knowledge_acl_events` (`target_type`,`target_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_kacl_events_actor` ON `knowledge_acl_events` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_kacl_events_type` ON `knowledge_acl_events` (`event_type`,`created_at`);--> statement-breakpoint
CREATE TABLE `narrator_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`principal_type` text NOT NULL,
	`principal_id` text NOT NULL,
	`access` text DEFAULT 'read' NOT NULL,
	`granted_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_narrator_grant_unique` ON `narrator_grants` (`narrator_id`,`principal_type`,`principal_id`);--> statement-breakpoint
CREATE INDEX `idx_narrator_grant_principal` ON `narrator_grants` (`principal_type`,`principal_id`);--> statement-breakpoint
CREATE INDEX `idx_narrator_grant_narrator` ON `narrator_grants` (`narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_narrator_grant_granted_by` ON `narrator_grants` (`granted_by`);--> statement-breakpoint
CREATE TABLE `registration_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`note` text,
	`role` text DEFAULT 'user' NOT NULL,
	`bound_username` text,
	`expires_at` text NOT NULL,
	`created_by_user_id` text,
	`used_at` text,
	`used_by_user_id` text,
	`revoked_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`used_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_registration_codes_code_hash` ON `registration_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `idx_registration_codes_created_by` ON `registration_codes` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `idx_registration_codes_used_by` ON `registration_codes` (`used_by_user_id`);--> statement-breakpoint
DROP TABLE `narrator_sidecars`;--> statement-breakpoint
DROP TABLE `terminal_tabs`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_container_instances` (
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
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_container_instances`("id", "chapter_id", "container_id", "service_name", "status", "host_port", "container_port", "proxy_label", "container_ip", "volume_name", "created_at", "updated_at") SELECT "id", "chapter_id", "container_id", "service_name", "status", "host_port", "container_port", "proxy_label", "container_ip", "volume_name", "created_at", "updated_at" FROM `container_instances`;--> statement-breakpoint
DROP TABLE `container_instances`;--> statement-breakpoint
ALTER TABLE `__new_container_instances` RENAME TO `container_instances`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_container_instances_chapter` ON `container_instances` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_container_instances_chapter_service` ON `container_instances` (`chapter_id`,`service_name`);--> statement-breakpoint
CREATE INDEX `idx_container_instances_container` ON `container_instances` (`container_id`);--> statement-breakpoint
CREATE INDEX `idx_container_instances_status` ON `container_instances` (`chapter_id`,`status`);--> statement-breakpoint
CREATE TABLE `__new_merge_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`target_chapter_id` text NOT NULL,
	`source_chapter_ids` text NOT NULL,
	`strategy` text DEFAULT 'merge' NOT NULL,
	`status` text NOT NULL,
	`current_index` integer DEFAULT 0 NOT NULL,
	`merged_count` integer DEFAULT 0 NOT NULL,
	`current_source_chapter_id` text,
	`conflict_files` text,
	`pre_merge_tree` text,
	`conflict_tree` text,
	`pre_merge_target_snapshot` text,
	`merge_source_snapshot` text,
	`pre_merge_target_sha` text,
	`error` text,
	`locale` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`target_chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_merge_sessions`("id", "target_chapter_id", "source_chapter_ids", "strategy", "status", "current_index", "merged_count", "current_source_chapter_id", "conflict_files", "pre_merge_tree", "conflict_tree", "pre_merge_target_snapshot", "merge_source_snapshot", "pre_merge_target_sha", "error", "locale", "created_at", "updated_at") SELECT "id", "target_chapter_id", "source_chapter_ids", "strategy", "status", "current_index", "merged_count", "current_source_chapter_id", "conflict_files", "pre_merge_tree", "conflict_tree", "pre_merge_target_snapshot", "merge_source_snapshot", "pre_merge_target_sha", "error", "locale", "created_at", "updated_at" FROM `merge_sessions`;--> statement-breakpoint
DROP TABLE `merge_sessions`;--> statement-breakpoint
ALTER TABLE `__new_merge_sessions` RENAME TO `merge_sessions`;--> statement-breakpoint
CREATE INDEX `idx_merge_sessions_target_chapter` ON `merge_sessions` (`target_chapter_id`);--> statement-breakpoint
CREATE TABLE `__new_port_allocations` (
	`port` integer PRIMARY KEY NOT NULL,
	`chapter_id` text,
	`service_name` text,
	`allocated_at` text NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_port_allocations`("port", "chapter_id", "service_name", "allocated_at") SELECT "port", "chapter_id", "service_name", "allocated_at" FROM `port_allocations`;--> statement-breakpoint
DROP TABLE `port_allocations`;--> statement-breakpoint
ALTER TABLE `__new_port_allocations` RENAME TO `port_allocations`;--> statement-breakpoint
CREATE INDEX `idx_port_allocations_chapter` ON `port_allocations` (`chapter_id`);--> statement-breakpoint
CREATE TABLE `__new_terminals` (
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
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_terminals`("id", "chapter_id", "narrator_id", "name", "cwd", "dtach_socket", "device_id", "status", "exit_code", "graph_opened", "graph_x", "graph_y", "graph_width", "graph_height", "created_at") SELECT "id", "chapter_id", "narrator_id", "name", "cwd", "dtach_socket", "device_id", "status", "exit_code", "graph_opened", "graph_x", "graph_y", "graph_width", "graph_height", "created_at" FROM `terminals`;--> statement-breakpoint
DROP TABLE `terminals`;--> statement-breakpoint
ALTER TABLE `__new_terminals` RENAME TO `terminals`;--> statement-breakpoint
CREATE INDEX `idx_terminals_chapter` ON `terminals` (`chapter_id`,`status`,`graph_opened`);--> statement-breakpoint
CREATE INDEX `idx_terminals_narrator` ON `terminals` (`narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_terminals_status` ON `terminals` (`status`);--> statement-breakpoint
ALTER TABLE `chapters` ADD `parked_snapshot_commit_sha` text;--> statement-breakpoint
ALTER TABLE `chapters` ADD `parked_snapshot_base_tree` text;--> statement-breakpoint
ALTER TABLE `chapters` ADD `graph_x` real;--> statement-breakpoint
ALTER TABLE `chapters` ADD `graph_y` real;--> statement-breakpoint
ALTER TABLE `chapters` ADD `dock_layout_json` text;--> statement-breakpoint
ALTER TABLE `chapters` ADD `detached_panels_json` text;--> statement-breakpoint
CREATE INDEX `idx_chapters_worktree_path` ON `chapters` (`worktree_path`);--> statement-breakpoint
ALTER TABLE `knowledge_collections` ADD `inherit_project_gate` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `started_at` text GENERATED ALWAYS AS (coalesce("execution_started_at", "permission_started_at", "stream_started_at", "created_at")) VIRTUAL;--> statement-breakpoint
CREATE INDEX `idx_toolcalls_started_at` ON `narrator_tool_calls` (`started_at`,`id`);--> statement-breakpoint
ALTER TABLE `narrators` ADD `avatar_image_id` text;--> statement-breakpoint
ALTER TABLE `narrators` ADD `owner_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `narrators` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_narrators_owner` ON `narrators` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_narrators_visibility` ON `narrators` (`visibility`);--> statement-breakpoint
ALTER TABLE `projects` ADD `traits` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `owner_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `projects` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE `remote_devices` ADD `path_rules_json` text;--> statement-breakpoint
ALTER TABLE `remote_devices` ADD `reported_path_rules_json` text;--> statement-breakpoint
ALTER TABLE `remote_devices` ADD `owner_scope` text DEFAULT 'shared' NOT NULL;--> statement-breakpoint
ALTER TABLE `remote_devices` ADD `enrolled_at` text;--> statement-breakpoint
ALTER TABLE `remote_devices` ADD `enrolled_from_ip` text;--> statement-breakpoint
ALTER TABLE `remote_devices` ADD `enrolled_user_agent` text;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `recent_tabs_group_mode` text DEFAULT 'flat' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `narrator_toolbar_layout` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `traits` text DEFAULT '[]' NOT NULL;