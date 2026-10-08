CREATE TABLE `integration_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`principal_type` text NOT NULL,
	`principal_id` text,
	`authority_id` text,
	`credential_type` text,
	`credential_id` text,
	`transport` text NOT NULL,
	`operation_id` text NOT NULL,
	`capability_id` text,
	`resource_type` text,
	`resource_id` text,
	`scope_type` text,
	`scope_id` text,
	`outcome` text NOT NULL,
	`reason_code` text,
	`duration_ms` integer,
	`request_bytes` integer DEFAULT 0 NOT NULL,
	`response_bytes` integer DEFAULT 0 NOT NULL,
	`metadata_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_integration_audit_created` ON `integration_audit_events` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_integration_audit_authority` ON `integration_audit_events` (`authority_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_integration_audit_operation` ON `integration_audit_events` (`operation_id`,`outcome`,`created_at`);--> statement-breakpoint
CREATE TABLE `integration_authorities` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`integration_type` text NOT NULL,
	`integration_id` text NOT NULL,
	`owner_user_id` text,
	`source_grant_id` text,
	`state` text DEFAULT 'active' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`policy_json` text,
	`metadata_json` text,
	`expires_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`revoked_at` text,
	`revoked_reason` text,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_integration_authorities_integration` ON `integration_authorities` (`integration_type`,`integration_id`,`state`,`id`);--> statement-breakpoint
CREATE INDEX `idx_integration_authorities_owner` ON `integration_authorities` (`owner_user_id`,`state`,`id`);--> statement-breakpoint
CREATE INDEX `idx_integration_authorities_expiry` ON `integration_authorities` (`state`,`expires_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_integration_authorities_source_grant` ON `integration_authorities` (`source_grant_id`) WHERE "integration_authorities"."source_grant_id" is not null;--> statement-breakpoint
CREATE TABLE `integration_capability_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`authority_id` text NOT NULL,
	`capability_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text,
	`scope_key` text NOT NULL,
	`constraints_json` text,
	`expires_at` text,
	`revoked_at` text,
	`created_by_type` text NOT NULL,
	`created_by_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`authority_id`) REFERENCES `integration_authorities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_integration_capability_grants_active_scope` ON `integration_capability_grants` (`authority_id`,`capability_id`,`scope_key`) WHERE "integration_capability_grants"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX `idx_integration_capability_grants_authority` ON `integration_capability_grants` (`authority_id`,`capability_id`,`revoked_at`,`expires_at`,`id`);--> statement-breakpoint
CREATE TABLE `integration_resource_bindings` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`authority_type` text NOT NULL,
	`authority_id` text NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`provision_key` text,
	`metadata_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`revoked_at` text,
	`orphaned_at` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_integration_resource_binding_resource` ON `integration_resource_bindings` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_integration_resource_binding_provision` ON `integration_resource_bindings` (`authority_id`,`resource_type`,`provision_key`);--> statement-breakpoint
CREATE INDEX `idx_integration_resource_binding_authority` ON `integration_resource_bindings` (`authority_type`,`authority_id`,`state`,`id`);--> statement-breakpoint
CREATE INDEX `idx_integration_resource_binding_source` ON `integration_resource_bindings` (`source_type`,`source_id`,`state`);--> statement-breakpoint
CREATE INDEX `idx_integration_resource_binding_state_updated` ON `integration_resource_bindings` (`state`,`updated_at`);--> statement-breakpoint
CREATE TABLE `narrator_tool_continuations` (
	`id` text PRIMARY KEY NOT NULL,
	`tool_call_id` text NOT NULL,
	`narrator_id` text NOT NULL,
	`update_epoch` text NOT NULL,
	`kind` text NOT NULL,
	`state` text DEFAULT 'paused' NOT NULL,
	`payload_json` text,
	`deadline_at` text,
	`claim_token` text,
	`claimed_at` text,
	`error_message` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tool_call_id`) REFERENCES `narrator_tool_calls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tool_continuations_tool_call` ON `narrator_tool_continuations` (`tool_call_id`);--> statement-breakpoint
CREATE INDEX `idx_tool_continuations_epoch_state` ON `narrator_tool_continuations` (`update_epoch`,`state`);--> statement-breakpoint
CREATE INDEX `idx_tool_continuations_narrator_state` ON `narrator_tool_continuations` (`narrator_id`,`state`);--> statement-breakpoint
CREATE TABLE `oauth_access_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`client_id` text NOT NULL,
	`oauth_client_id` text,
	`grant_id` text,
	`user_id` text NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`expires_at` text NOT NULL,
	`refresh_token_hash` text,
	`refresh_expires_at` text,
	`refresh_family_id` text,
	`refresh_family_expires_at` text,
	`refresh_family_revoked_at` text,
	`refresh_parent_token_id` text,
	`refresh_replaced_by_token_id` text,
	`refresh_used_at` text,
	`refresh_reuse_detected_at` text,
	`last_used_at` text,
	`revoked_at` text,
	`revoked_by_user_id` text,
	`revoked_by_type` text,
	`revoked_reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`oauth_client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grant_id`) REFERENCES `oauth_grants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`revoked_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_oauth_access_tokens_token_hash` ON `oauth_access_tokens` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_oauth_access_tokens_refresh_hash` ON `oauth_access_tokens` (`refresh_token_hash`);--> statement-breakpoint
CREATE INDEX `idx_oauth_access_tokens_client` ON `oauth_access_tokens` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_oauth_access_tokens_oauth_client` ON `oauth_access_tokens` (`oauth_client_id`);--> statement-breakpoint
CREATE INDEX `idx_oauth_access_tokens_grant_revoked` ON `oauth_access_tokens` (`grant_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `idx_oauth_access_tokens_refresh_family` ON `oauth_access_tokens` (`refresh_family_id`,`revoked_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_oauth_access_tokens_refresh_parent` ON `oauth_access_tokens` (`refresh_parent_token_id`);--> statement-breakpoint
CREATE INDEX `idx_oauth_access_tokens_user` ON `oauth_access_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_oauth_access_tokens_revoked_by_user` ON `oauth_access_tokens` (`revoked_by_user_id`);--> statement-breakpoint
CREATE TABLE `oauth_authorization_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`client_id` text NOT NULL,
	`oauth_client_id` text,
	`grant_id` text,
	`user_id` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`code_challenge` text NOT NULL,
	`code_challenge_method` text DEFAULT 'S256' NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`oauth_client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grant_id`) REFERENCES `oauth_grants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_oauth_authorization_codes_code_hash` ON `oauth_authorization_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `idx_oauth_authorization_codes_client` ON `oauth_authorization_codes` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_oauth_authorization_codes_oauth_client` ON `oauth_authorization_codes` (`oauth_client_id`);--> statement-breakpoint
CREATE INDEX `idx_oauth_authorization_codes_grant` ON `oauth_authorization_codes` (`grant_id`);--> statement-breakpoint
CREATE INDEX `idx_oauth_authorization_codes_user` ON `oauth_authorization_codes` (`user_id`);--> statement-breakpoint
CREATE TABLE `oauth_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`redirect_uris` text DEFAULT '[]' NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`grant_types` text DEFAULT '["authorization_code","refresh_token"]' NOT NULL,
	`public_client` integer DEFAULT true NOT NULL,
	`policy_json` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	`revoked_by_user_id` text,
	`revoked_reason` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`revoked_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_oauth_clients_client_id` ON `oauth_clients` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_oauth_clients_created_by` ON `oauth_clients` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_oauth_clients_revoked_by_user` ON `oauth_clients` (`revoked_by_user_id`);--> statement-breakpoint
CREATE TABLE `oauth_grant_events` (
	`id` text PRIMARY KEY NOT NULL,
	`grant_id` text,
	`oauth_client_id` text NOT NULL,
	`user_id` text,
	`actor_type` text NOT NULL,
	`actor_user_id` text,
	`event_type` text NOT NULL,
	`requested_scopes` text DEFAULT '[]' NOT NULL,
	`granted_scopes` text DEFAULT '[]' NOT NULL,
	`project_ids` text DEFAULT '[]' NOT NULL,
	`reason` text,
	`metadata` text,
	`ip_address` text,
	`user_agent` text,
	`request_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`grant_id`) REFERENCES `oauth_grants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`oauth_client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_oauth_grant_events_grant_created` ON `oauth_grant_events` (`grant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_oauth_grant_events_client_created` ON `oauth_grant_events` (`oauth_client_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_oauth_grant_events_user_created` ON `oauth_grant_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_oauth_grant_events_request` ON `oauth_grant_events` (`request_id`);--> statement-breakpoint
CREATE INDEX `idx_oauth_grant_events_actor_user` ON `oauth_grant_events` (`actor_user_id`);--> statement-breakpoint
CREATE TABLE `oauth_grant_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`grant_id` text NOT NULL,
	`project_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`grant_id`) REFERENCES `oauth_grants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_oauth_grant_projects_grant_project` ON `oauth_grant_projects` (`grant_id`,`project_id`);--> statement-breakpoint
CREATE INDEX `idx_oauth_grant_projects_project` ON `oauth_grant_projects` (`project_id`);--> statement-breakpoint
CREATE TABLE `oauth_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`oauth_client_id` text NOT NULL,
	`user_id` text NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`policy_json` text,
	`legacy_unscoped` integer DEFAULT false NOT NULL,
	`consented_at` text,
	`last_token_issued_at` text,
	`last_used_at` text,
	`revoked_at` text,
	`revoked_by_user_id` text,
	`revoked_by_type` text,
	`revoked_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`oauth_client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`revoked_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_oauth_grants_active_user_client` ON `oauth_grants` (`user_id`,`oauth_client_id`) WHERE "oauth_grants"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX `idx_oauth_grants_client_revoked` ON `oauth_grants` (`oauth_client_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `idx_oauth_grants_user_revoked` ON `oauth_grants` (`user_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `idx_oauth_grants_revoked_by_user` ON `oauth_grants` (`revoked_by_user_id`);--> statement-breakpoint
CREATE TABLE `oauth_security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`endpoint` text NOT NULL,
	`bucket_type` text NOT NULL,
	`client_id` text,
	`grant_id` text,
	`user_id` text,
	`retry_after_seconds` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`grant_id`) REFERENCES `oauth_grants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_oauth_security_events_created` ON `oauth_security_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_oauth_security_events_type_created` ON `oauth_security_events` (`event_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_oauth_security_events_user` ON `oauth_security_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_oauth_security_events_grant` ON `oauth_security_events` (`grant_id`);--> statement-breakpoint
CREATE TABLE `user_plugin_themes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plugin_id` text NOT NULL,
	`theme_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_plugin_themes_unique` ON `user_plugin_themes` (`user_id`,`plugin_id`,`theme_id`);--> statement-breakpoint
CREATE INDEX `idx_user_plugin_themes_user` ON `user_plugin_themes` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_recent_tabs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tab_key` text NOT NULL,
	`section` text NOT NULL,
	`type` text NOT NULL,
	`entity_id` text NOT NULL,
	`narrator_id` text,
	`represented_narrator_id` text,
	`parent_narrator_id` text,
	`workspace_id` text,
	`title` text NOT NULL,
	`subtitle` text,
	`status` text,
	`last_visited_at` integer NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`is_scheduled` integer DEFAULT false NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_recent_tabs_user_key` ON `user_recent_tabs` (`user_id`,`tab_key`);--> statement-breakpoint
CREATE INDEX `idx_user_recent_tabs_user_section_order` ON `user_recent_tabs` (`user_id`,`section`,`sort_order`,`tab_key`);--> statement-breakpoint
CREATE INDEX `idx_user_recent_tabs_user_workspace` ON `user_recent_tabs` (`user_id`,`workspace_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_user_recent_tabs_narrator` ON `user_recent_tabs` (`represented_narrator_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_recent_tabs_entity` ON `user_recent_tabs` (`type`,`entity_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `user_recent_tabs_meta` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`migrated_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_terminal_view_state` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`chapter_id` text,
	`narrator_id` text,
	`layout` text DEFAULT 'single' NOT NULL,
	`active_tab_id` text,
	`panel_assignments` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_terminal_view_state`("id", "user_id", "chapter_id", "narrator_id", "layout", "active_tab_id", "panel_assignments", "updated_at") SELECT "id", "user_id", "chapter_id", "narrator_id", "layout", "active_tab_id", "panel_assignments", "updated_at" FROM `terminal_view_state`;--> statement-breakpoint
DROP TABLE `terminal_view_state`;--> statement-breakpoint
ALTER TABLE `__new_terminal_view_state` RENAME TO `terminal_view_state`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_view_state_user_chapter` ON `terminal_view_state` (`user_id`,`chapter_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_view_state_user_narrator` ON `terminal_view_state` (`user_id`,`narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_view_state_chapter` ON `terminal_view_state` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_view_state_narrator` ON `terminal_view_state` (`narrator_id`);--> statement-breakpoint
DROP INDEX `idx_api_requests_created`;--> statement-breakpoint
CREATE INDEX `idx_api_requests_created` ON `api_requests` (`created_at`,`id`);--> statement-breakpoint
DROP INDEX `idx_messages_parent_tool_use_lookup`;--> statement-breakpoint
ALTER TABLE `narrator_messages` ADD `origin` text;--> statement-breakpoint
ALTER TABLE `narrator_messages` ADD `origin_label` text;--> statement-breakpoint
CREATE INDEX `idx_messages_created_by` ON `narrator_messages` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_messages_edited_by` ON `narrator_messages` (`edited_by`);--> statement-breakpoint
CREATE INDEX `idx_messages_parent_tool_use_lookup` ON `narrator_messages` (`parent_tool_use_id`,`created_at`);--> statement-breakpoint
DROP INDEX `idx_sidecars_tool_use`;--> statement-breakpoint
CREATE INDEX `idx_sidecars_tool_use` ON `narrator_sidecars` (`tool_use_id`,`target`,`order_index`,`created_at`);--> statement-breakpoint
DROP INDEX `idx_terminals_chapter`;--> statement-breakpoint
CREATE INDEX `idx_terminals_chapter` ON `terminals` (`chapter_id`,`status`,`graph_opened`);--> statement-breakpoint
ALTER TABLE `narrators` ADD `message_structure_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `narrators` ADD `oauth_owner_grant_id` text REFERENCES oauth_grants(id);--> statement-breakpoint
ALTER TABLE `narrators` ADD `oauth_provision_key` text;--> statement-breakpoint
ALTER TABLE `narrators` ADD `context_project_id` text REFERENCES projects(id);--> statement-breakpoint
ALTER TABLE `narrators` ADD `oauth_policy_snapshot_json` text;--> statement-breakpoint
CREATE INDEX `idx_narrators_variant_updated` ON `narrators` (`variant`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_narrators_context_project` ON `narrators` (`context_project_id`);--> statement-breakpoint
CREATE INDEX `idx_narrators_oauth_owner` ON `narrators` (`oauth_owner_grant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_narrators_oauth_provision` ON `narrators` (`oauth_owner_grant_id`,`oauth_provision_key`);--> statement-breakpoint
CREATE INDEX `idx_narrators_fork_message` ON `narrators` (`fork_message_id`);--> statement-breakpoint
CREATE INDEX `idx_narrators_prune_boundary_message` ON `narrators` (`prune_boundary_message_id`);--> statement-breakpoint
ALTER TABLE `remote_devices` ADD `oauth_owner_grant_id` text REFERENCES oauth_grants(id);--> statement-breakpoint
ALTER TABLE `remote_devices` ADD `oauth_provision_key` text;--> statement-breakpoint
CREATE INDEX `idx_remote_devices_oauth_owner` ON `remote_devices` (`oauth_owner_grant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_remote_devices_oauth_provision` ON `remote_devices` (`oauth_owner_grant_id`,`oauth_provision_key`);--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `nav_layout` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `token_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_benchmark_runs_suite` ON `benchmark_runs` (`suite_id`);--> statement-breakpoint
CREATE INDEX `idx_task_results_narrator` ON `benchmark_task_results` (`narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_chapter_commits_narrator_message` ON `chapter_commits` (`narrator_message_id`);--> statement-breakpoint
CREATE INDEX `idx_chapters_merged_into` ON `chapters` (`merged_into_chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_chapters_review_source` ON `chapters` (`review_source_chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_chapters_exploration_group` ON `chapters` (`exploration_group_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_group_members_user` ON `chat_group_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_group_messages_sender_narrator` ON `chat_group_messages` (`sender_narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_group_messages_sender_user` ON `chat_group_messages` (`sender_user_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_groups_created_by` ON `chat_groups` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_container_instances_chapter` ON `container_instances` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_container_instances_chapter_service` ON `container_instances` (`chapter_id`,`service_name`);--> statement-breakpoint
CREATE INDEX `idx_container_instances_container` ON `container_instances` (`container_id`);--> statement-breakpoint
CREATE INDEX `idx_container_instances_status` ON `container_instances` (`chapter_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_device_transfer_tasks_created_by` ON `device_transfer_tasks` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_exploration_groups_project` ON `exploration_groups` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_exploration_groups_base_chapter` ON `exploration_groups` (`base_chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_exploration_groups_decided_chapter` ON `exploration_groups` (`decided_chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_gsm_chapter` ON `gateway_session_mappings` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_gsm_project` ON `gateway_session_mappings` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_kc_owner_user` ON `knowledge_collections` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_kd_target_collection` ON `knowledge_drafts` (`target_collection_id`);--> statement-breakpoint
CREATE INDEX `idx_ke_owner_user` ON `knowledge_entries` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_kelink_created_by_user` ON `knowledge_entry_links` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `idx_kelink_to_revision` ON `knowledge_entry_links` (`to_revision_id`);--> statement-breakpoint
CREATE INDEX `idx_kgrant_collection` ON `knowledge_grants` (`collection_id`);--> statement-breakpoint
CREATE INDEX `idx_kie_trigger_message` ON `knowledge_injection_events` (`trigger_message_id`);--> statement-breakpoint
CREATE INDEX `idx_kie_trigger_tool_call` ON `knowledge_injection_events` (`trigger_tool_call_id`);--> statement-breakpoint
CREATE INDEX `idx_kie_entry_revision` ON `knowledge_injection_events` (`entry_revision_id`);--> statement-breakpoint
CREATE INDEX `idx_kpack_owner_user` ON `knowledge_packs` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_kr_author_user` ON `knowledge_revisions` (`author_user_id`);--> statement-breakpoint
CREATE INDEX `idx_ks_reviewer_user` ON `knowledge_submissions` (`reviewer_user_id`);--> statement-breakpoint
CREATE INDEX `idx_ks_collection` ON `knowledge_submissions` (`collection_id`);--> statement-breakpoint
CREATE INDEX `idx_ks_draft` ON `knowledge_submissions` (`draft_id`);--> statement-breakpoint
CREATE INDEX `idx_merge_sessions_target_chapter` ON `merge_sessions` (`target_chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_port_allocations_chapter` ON `port_allocations` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_scheduled_tasks_created_by` ON `scheduled_tasks` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_scheduled_tasks_reuse_narrator` ON `scheduled_tasks` (`reuse_narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_scheduled_tasks_chapter` ON `scheduled_tasks` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_spec_file_revisions_source_message` ON `spec_file_revisions` (`source_message_id`);--> statement-breakpoint
CREATE INDEX `idx_spec_protected_tasks_first_revision` ON `spec_protected_tasks` (`first_revision_id`);--> statement-breakpoint
CREATE INDEX `idx_spec_protected_tasks_last_revision` ON `spec_protected_tasks` (`last_revision_id`);--> statement-breakpoint
CREATE INDEX `idx_webauthn_challenge_user` ON `webauthn_challenges` (`user_id`);