CREATE TABLE `file_change_blob_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`budget_id` text NOT NULL,
	`owner_epoch` text NOT NULL,
	`generation` integer DEFAULT 0 NOT NULL,
	`expected_size` integer NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`blob_digest` text,
	`published` integer,
	`created_at` text NOT NULL,
	`settled_at` text,
	FOREIGN KEY (`budget_id`) REFERENCES `file_change_storage_budgets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`blob_digest`) REFERENCES `file_change_blobs`(`digest`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_fc_reservation_budget` ON `file_change_blob_reservations` (`budget_id`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_fc_reservation_owner` ON `file_change_blob_reservations` (`owner_epoch`,`status`);--> statement-breakpoint
CREATE INDEX `idx_fc_reservation_blob` ON `file_change_blob_reservations` (`blob_digest`);--> statement-breakpoint
CREATE TABLE `file_change_blobs` (
	`id` text PRIMARY KEY NOT NULL,
	`digest` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_key` text NOT NULL,
	`status` text DEFAULT 'staging' NOT NULL,
	`lease_until` text,
	`gc_generation` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fc_blob_digest` ON `file_change_blobs` (`digest`);--> statement-breakpoint
CREATE INDEX `idx_fc_blob_gc` ON `file_change_blobs` (`status`,`lease_until`,`updated_at`);--> statement-breakpoint
CREATE TABLE `file_change_effects` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_id` text NOT NULL,
	`journal_seq` integer,
	`scope_id` text NOT NULL,
	`file_key` text NOT NULL,
	`identity_json` text NOT NULL,
	`scope_revision` integer NOT NULL,
	`mutation_id` text NOT NULL,
	`request_digest` text NOT NULL,
	`phase` text NOT NULL,
	`before_state_json` text NOT NULL,
	`intended_after_state_json` text NOT NULL,
	`observed_after_state_json` text NOT NULL,
	`before_blob_digest` text,
	`intended_after_blob_digest` text,
	`observed_after_blob_digest` text,
	`outcome` text DEFAULT 'pending' NOT NULL,
	`settlement` text DEFAULT 'preparing' NOT NULL,
	`attribution_grade` text DEFAULT 'unknown' NOT NULL,
	`attribution_ceiling` text,
	`execution_confirmed` integer DEFAULT false NOT NULL,
	`execution_receipt_json` text,
	`execution_receipt_digest` text,
	`lines_added` integer,
	`lines_removed` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`operation_id`) REFERENCES `file_change_operations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scope_id`) REFERENCES `file_change_scopes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`before_blob_digest`) REFERENCES `file_change_blobs`(`digest`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`intended_after_blob_digest`) REFERENCES `file_change_blobs`(`digest`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`observed_after_blob_digest`) REFERENCES `file_change_blobs`(`digest`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fc_effect_mutation` ON `file_change_effects` (`mutation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fc_effect_operation_file` ON `file_change_effects` (`operation_id`,`file_key`,`phase`);--> statement-breakpoint
CREATE INDEX `idx_fc_effect_file` ON `file_change_effects` (`scope_id`,`file_key`,`scope_revision`,`id`);--> statement-breakpoint
CREATE INDEX `idx_fc_effect_pending` ON `file_change_effects` (`settlement`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_fc_effect_before_blob` ON `file_change_effects` (`before_blob_digest`);--> statement-breakpoint
CREATE INDEX `idx_fc_effect_intended_blob` ON `file_change_effects` (`intended_after_blob_digest`);--> statement-breakpoint
CREATE INDEX `idx_fc_effect_observed_blob` ON `file_change_effects` (`observed_after_blob_digest`);--> statement-breakpoint
CREATE TABLE `file_change_execution_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`parent_segment_id` text,
	`source_tool_call_id` text,
	`source_execution_attempt` integer,
	`source_input_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_fc_segment_source` ON `file_change_execution_segments` (`source_tool_call_id`,`source_execution_attempt`);--> statement-breakpoint
CREATE INDEX `idx_fc_segment_parent` ON `file_change_execution_segments` (`parent_segment_id`);--> statement-breakpoint
CREATE INDEX `idx_fc_segment_narrator` ON `file_change_execution_segments` (`narrator_id`);--> statement-breakpoint
CREATE TABLE `file_change_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`journal_seq` integer,
	`execution_segment_id` text,
	`evidence_version` integer DEFAULT 2 NOT NULL,
	`source_instance_id` text NOT NULL,
	`source_kind` text NOT NULL,
	`source_id` text NOT NULL,
	`attempt` integer NOT NULL,
	`request_digest` text,
	`expected_effect_count` integer,
	`prepared_effect_count` integer DEFAULT 0 NOT NULL,
	`evidence_bytes` integer DEFAULT 0 NOT NULL,
	`settled_effect_count` integer DEFAULT 0 NOT NULL,
	`unresolved_effect_count` integer DEFAULT 0 NOT NULL,
	`tool_call_id` text,
	`tool_use_id` text,
	`background_task_id` text,
	`narrator_id` text,
	`project_id` text,
	`owner_user_id` text,
	`actor_subject_key` text NOT NULL,
	`actor_json` text NOT NULL,
	`initiator_subject_key` text,
	`execution_binding_json` text,
	`execution_outcome` text DEFAULT 'running' NOT NULL,
	`effect_outcome` text DEFAULT 'pending' NOT NULL,
	`settlement` text DEFAULT 'preparing' NOT NULL,
	`attribution_grade` text DEFAULT 'unknown' NOT NULL,
	`coverage` text DEFAULT 'unavailable' NOT NULL,
	`parent_operation_id` text,
	`reason` text,
	`lease_until` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fc_operation_attempt` ON `file_change_operations` (`source_instance_id`,`source_kind`,`source_id`,`attempt`);--> statement-breakpoint
CREATE INDEX `idx_fc_operation_sequence` ON `file_change_operations` (`source_instance_id`,`journal_seq`);--> statement-breakpoint
CREATE INDEX `idx_fc_operation_segment` ON `file_change_operations` (`execution_segment_id`,`journal_seq`);--> statement-breakpoint
CREATE INDEX `idx_fc_operation_narrator` ON `file_change_operations` (`narrator_id`,`started_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_fc_operation_actor` ON `file_change_operations` (`actor_subject_key`,`started_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_fc_operation_pending` ON `file_change_operations` (`settlement`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_fc_operation_task` ON `file_change_operations` (`background_task_id`,`attempt`);--> statement-breakpoint
CREATE INDEX `idx_fc_operation_parent` ON `file_change_operations` (`parent_operation_id`);--> statement-breakpoint
CREATE TABLE `file_change_rollups` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_id` text NOT NULL,
	`file_key` text NOT NULL,
	`actor_subject_key` text NOT NULL,
	`projection_kind` text NOT NULL,
	`attempt_key` text DEFAULT '' NOT NULL,
	`change_count` integer DEFAULT 0 NOT NULL,
	`lines_added` integer DEFAULT 0 NOT NULL,
	`lines_removed` integer DEFAULT 0 NOT NULL,
	`unmeasured_count` integer DEFAULT 0 NOT NULL,
	`has_external_change` integer DEFAULT false NOT NULL,
	`has_imprecise_attribution` integer DEFAULT true NOT NULL,
	`complete` integer DEFAULT false NOT NULL,
	`as_of_revision` integer,
	`last_effect_id` text,
	`head_fingerprint` text,
	`index_fingerprint` text,
	`worktree_fingerprint` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scope_id`) REFERENCES `file_change_scopes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`last_effect_id`) REFERENCES `file_change_effects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fc_rollup_dimension` ON `file_change_rollups` (`scope_id`,`file_key`,`actor_subject_key`,`projection_kind`,`attempt_key`);--> statement-breakpoint
CREATE INDEX `idx_fc_rollup_actor` ON `file_change_rollups` (`actor_subject_key`,`projection_kind`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_fc_rollup_effect` ON `file_change_rollups` (`last_effect_id`);--> statement-breakpoint
CREATE TABLE `file_change_scope_recoveries` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_lease_id` text,
	`resolution_authority` text DEFAULT 'execution_proven' NOT NULL,
	`maintenance_evidence_json` text,
	`scope_id` text NOT NULL,
	`device_id` text NOT NULL,
	`canonical_root` text NOT NULL,
	`path_flavor` text NOT NULL,
	`recovered_by_user_id` text,
	`effect_decisions_json` text NOT NULL,
	`scope_revision_before` integer NOT NULL,
	`fencing_token_before` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`scope_id`) REFERENCES `file_change_scopes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recovered_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_fc_scope_recovery_scope` ON `file_change_scope_recoveries` (`scope_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `file_change_scopes` (
	`id` text PRIMARY KEY NOT NULL,
	`source_instance_id` text NOT NULL,
	`device_id` text NOT NULL,
	`workspace_instance_id` text NOT NULL,
	`canonical_root` text NOT NULL,
	`display_root` text NOT NULL,
	`path_flavor` text NOT NULL,
	`status` text DEFAULT 'needs_verification' NOT NULL,
	`root_identity_json` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`fencing_token` integer DEFAULT 0 NOT NULL,
	`active_lease_id` text,
	`active_lease_epoch` text,
	`active_lease_started_at` text,
	`active_mutation_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fc_scope_instance` ON `file_change_scopes` (`source_instance_id`,`device_id`,`workspace_instance_id`);--> statement-breakpoint
CREATE INDEX `idx_fc_scope_root` ON `file_change_scopes` (`source_instance_id`,`device_id`,`canonical_root`);--> statement-breakpoint
CREATE INDEX `idx_fc_scope_status` ON `file_change_scopes` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_fc_scope_active_lease` ON `file_change_scopes` (`device_id`,`active_lease_id`,`canonical_root`);--> statement-breakpoint
CREATE TABLE `file_change_storage_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace_key` text NOT NULL,
	`status` text DEFAULT 'unverified' NOT NULL,
	`used_bytes` integer DEFAULT 0 NOT NULL,
	`reserved_bytes` integer DEFAULT 0 NOT NULL,
	`quota_bytes` integer NOT NULL,
	`generation` integer DEFAULT 0 NOT NULL,
	`reconciled_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fc_storage_namespace` ON `file_change_storage_budgets` (`namespace_key`);--> statement-breakpoint
CREATE TABLE `file_history_clock` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_seq` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `narrator_public_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`guest_name` text NOT NULL,
	`label` text,
	`created_by_user_id` text,
	`created_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_narrator_public_shares_token_hash` ON `narrator_public_shares` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_narrator_public_shares_narrator_created` ON `narrator_public_shares` (`narrator_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_narrator_public_shares_created_by` ON `narrator_public_shares` (`created_by_user_id`);--> statement-breakpoint
CREATE TABLE `narrator_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`narrator_id` text NOT NULL,
	`tool_call_id` text NOT NULL,
	`tool_use_id` text NOT NULL,
	`questions_json` text NOT NULL,
	`execution_principal_json` text,
	`answers_json` text,
	`annotations_json` text,
	`status` text DEFAULT 'open' NOT NULL,
	`origin` text DEFAULT 'agent_async' NOT NULL,
	`answer_message_id` text,
	`decided_by` text,
	`decided_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tool_call_id`) REFERENCES `narrator_tool_calls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_narrator_questions_tool_call` ON `narrator_questions` (`tool_call_id`);--> statement-breakpoint
CREATE INDEX `idx_narrator_questions_narrator_status` ON `narrator_questions` (`narrator_id`,`status`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`project_id` text,
	`chapter_id` text,
	`narrator_id` text,
	`title` text NOT NULL,
	`preview` text DEFAULT '' NOT NULL,
	`link_json` text NOT NULL,
	`source_key` text NOT NULL,
	`status` text DEFAULT 'unread' NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notifications_user_kind_source` ON `notifications` (`user_id`,`kind`,`source_key`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user_created` ON `notifications` (`user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user_status_created` ON `notifications` (`user_id`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `revert_operation_files` (
	`id` text PRIMARY KEY NOT NULL,
	`revert_operation_id` text NOT NULL,
	`scope_id` text NOT NULL,
	`file_key` text NOT NULL,
	`identity_json` text NOT NULL,
	`sequence` integer NOT NULL,
	`expected_state_json` text NOT NULL,
	`desired_state_json` text NOT NULL,
	`observed_after_state_json` text,
	`before_blob_digest` text,
	`desired_blob_digest` text,
	`observed_after_blob_digest` text,
	`compensation_after_state_json` text,
	`compensation_after_blob_digest` text,
	`apply_mutation_id` text NOT NULL,
	`apply_request_digest` text NOT NULL,
	`compensate_mutation_id` text NOT NULL,
	`compensate_request_digest` text NOT NULL,
	`status` text DEFAULT 'prepared' NOT NULL,
	`receipt_json` text,
	`reason` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`revert_operation_id`) REFERENCES `revert_operations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scope_id`) REFERENCES `file_change_scopes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`before_blob_digest`) REFERENCES `file_change_blobs`(`digest`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`desired_blob_digest`) REFERENCES `file_change_blobs`(`digest`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`observed_after_blob_digest`) REFERENCES `file_change_blobs`(`digest`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`compensation_after_blob_digest`) REFERENCES `file_change_blobs`(`digest`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_revert_file_identity` ON `revert_operation_files` (`revert_operation_id`,`file_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_revert_file_apply` ON `revert_operation_files` (`apply_mutation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_revert_file_compensate` ON `revert_operation_files` (`compensate_mutation_id`);--> statement-breakpoint
CREATE INDEX `idx_revert_file_pending` ON `revert_operation_files` (`revert_operation_id`,`status`,`sequence`);--> statement-breakpoint
CREATE INDEX `idx_revert_file_before_blob` ON `revert_operation_files` (`before_blob_digest`);--> statement-breakpoint
CREATE INDEX `idx_revert_file_desired_blob` ON `revert_operation_files` (`desired_blob_digest`);--> statement-breakpoint
CREATE INDEX `idx_revert_file_observed_blob` ON `revert_operation_files` (`observed_after_blob_digest`);--> statement-breakpoint
CREATE INDEX `idx_revert_file_compensation_blob` ON `revert_operation_files` (`compensation_after_blob_digest`);--> statement-breakpoint
CREATE TABLE `revert_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`protocol_version` integer DEFAULT 2 NOT NULL,
	`narrator_id` text,
	`project_id` text,
	`requested_by_subject_key` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_digest` text NOT NULL,
	`kind` text NOT NULL,
	`scope` text NOT NULL,
	`selector_kind` text NOT NULL,
	`selector_blob_digest` text,
	`plan_blob_digest` text,
	`history_manifest_blob_digest` text,
	`plan_hash` text,
	`expected_message_version` integer,
	`parent_revert_id` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`file_count` integer DEFAULT 0 NOT NULL,
	`applied_file_count` integer DEFAULT 0 NOT NULL,
	`coverage_complete` integer DEFAULT false NOT NULL,
	`reason` text,
	`expires_at` text NOT NULL,
	`lease_until` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`selector_blob_digest`) REFERENCES `file_change_blobs`(`digest`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_blob_digest`) REFERENCES `file_change_blobs`(`digest`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`history_manifest_blob_digest`) REFERENCES `file_change_blobs`(`digest`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_revert_operation_request` ON `revert_operations` (`requested_by_subject_key`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_revert_operation_narrator` ON `revert_operations` (`narrator_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_revert_operation_pending` ON `revert_operations` (`status`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_revert_operation_owner_pending` ON `revert_operations` (`requested_by_subject_key`,`narrator_id`,`project_id`,`status`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_revert_operation_parent` ON `revert_operations` (`parent_revert_id`);--> statement-breakpoint
CREATE INDEX `idx_revert_operation_plan_blob` ON `revert_operations` (`plan_blob_digest`);--> statement-breakpoint
CREATE INDEX `idx_revert_operation_selector_blob` ON `revert_operations` (`selector_blob_digest`);--> statement-breakpoint
CREATE INDEX `idx_revert_operation_history_blob` ON `revert_operations` (`history_manifest_blob_digest`);--> statement-breakpoint
CREATE TABLE `runtime_publication_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`producer_kind` text NOT NULL,
	`task_id` text NOT NULL,
	`logical_run_id` text NOT NULL,
	`event_kind` text NOT NULL,
	`recipient_id` text NOT NULL,
	`state` text DEFAULT 'reserved' NOT NULL,
	`arrival_seq` integer,
	`result_ref` text,
	`summary` text,
	`delivery_id` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_runtime_outbox_event` ON `runtime_publication_outbox` (`producer_kind`,`task_id`,`logical_run_id`,`event_kind`,`recipient_id`);--> statement-breakpoint
CREATE INDEX `idx_runtime_outbox_order` ON `runtime_publication_outbox` (`recipient_id`,`producer_kind`,`state`,`arrival_seq`);--> statement-breakpoint
CREATE INDEX `idx_runtime_outbox_recipient` ON `runtime_publication_outbox` (`recipient_id`);--> statement-breakpoint
CREATE INDEX `idx_runtime_outbox_state` ON `runtime_publication_outbox` (`state`,`id`);--> statement-breakpoint
CREATE TABLE `snapshot_captures` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_id` text NOT NULL,
	`operation_id` text,
	`tree_hash` text,
	`snapshot_commit_sha` text,
	`coverage` text DEFAULT 'unavailable' NOT NULL,
	`temporal_consistency` text DEFAULT 'unknown' NOT NULL,
	`policy_version` integer NOT NULL,
	`ignore_policy_digest` text,
	`manifest_blob_digest` text,
	`omitted_count` integer,
	`reason` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`scope_id`) REFERENCES `file_change_scopes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operation_id`) REFERENCES `file_change_operations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manifest_blob_digest`) REFERENCES `file_change_blobs`(`digest`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_snapshot_capture_scope` ON `snapshot_captures` (`scope_id`,`started_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_snapshot_capture_tree` ON `snapshot_captures` (`scope_id`,`tree_hash`);--> statement-breakpoint
CREATE INDEX `idx_snapshot_capture_operation` ON `snapshot_captures` (`operation_id`);--> statement-breakpoint
CREATE INDEX `idx_snapshot_capture_manifest` ON `snapshot_captures` (`manifest_blob_digest`);--> statement-breakpoint
CREATE TABLE `user_usage_totals` (
	`user_id` text PRIMARY KEY NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cached_input_tokens` integer DEFAULT 0 NOT NULL,
	`cache_creation_tokens` integer DEFAULT 0 NOT NULL,
	`reasoning_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`unpriced_request_count` integer DEFAULT 0 NOT NULL,
	`partial_request_count` integer DEFAULT 0 NOT NULL,
	`first_used_at` text NOT NULL,
	`last_used_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace_execution_owners` (
	`owner_epoch` text PRIMARY KEY NOT NULL,
	`identity_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace_panels` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`narrator_id` text,
	`config_json` text,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_workspace_panels_workspace` ON `workspace_panels` (`workspace_id`,`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workspace_panels_narrator` ON `workspace_panels` (`workspace_id`,`narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_workspace_panels_narrator_lookup` ON `workspace_panels` (`narrator_id`);--> statement-breakpoint
CREATE TABLE `workspace_write_leases` (
	`lease_id` text PRIMARY KEY NOT NULL,
	`scope_id` text NOT NULL,
	`device_id` text NOT NULL,
	`owner_epoch` text NOT NULL,
	`execution_class` text DEFAULT 'unknown' NOT NULL,
	`runtime_epoch` text NOT NULL,
	`runtime_generation` integer NOT NULL,
	`fencing_token` integer NOT NULL,
	`scope_revision` integer NOT NULL,
	`path_flavor` text NOT NULL,
	`status` text NOT NULL,
	`ranges_json` text NOT NULL,
	`mutation_manifest_json` text NOT NULL,
	`execution_ended_at` text,
	`termination_evidence_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scope_id`) REFERENCES `file_change_scopes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_workspace_lease_device_status` ON `workspace_write_leases` (`device_id`,`status`,`lease_id`);--> statement-breakpoint
CREATE INDEX `idx_workspace_lease_scope` ON `workspace_write_leases` (`scope_id`,`status`,`lease_id`);--> statement-breakpoint
CREATE INDEX `idx_workspace_lease_cleanup` ON `workspace_write_leases` (`status`,`updated_at`,`lease_id`);--> statement-breakpoint
CREATE INDEX `idx_workspace_lease_owner` ON `workspace_write_leases` (`owner_epoch`,`lease_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_narrators` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text,
	`api_conversation_id` text,
	`logical_run_id` text,
	`inbox_sequence` integer DEFAULT 0 NOT NULL,
	`next_seq` integer DEFAULT 0 NOT NULL,
	`fork_message_id` text,
	`type` text DEFAULT 'primary' NOT NULL,
	`subagent_type` text,
	`title` text,
	`inherit_mode` text DEFAULT 'fresh' NOT NULL,
	`parent_narrator_id` text,
	`origin_tool_call_id` text,
	`subagent_origin_kind` text,
	`context_summary` text,
	`model` text DEFAULT 'claude-sonnet-4.5',
	`pending_model_restore` text,
	`system_prompt` text,
	`permission_mode` text DEFAULT 'default',
	`previous_permission_mode` text,
	`plan_file_id` text,
	`reasoning_effort` text,
	`fast_mode` integer DEFAULT false NOT NULL,
	`fast_mode_override` text DEFAULT 'inherit' NOT NULL,
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
	`error_retryable` integer,
	`refs_inherited_from` text,
	`refs_backfill_cursor` integer,
	`enabled_tools` text,
	`variant` text DEFAULT 'primary' NOT NULL,
	`traits` text DEFAULT '[]' NOT NULL,
	`handle` text,
	`handle_fold` text,
	`is_background` integer DEFAULT false NOT NULL,
	`background_status` text,
	`background_result` text,
	`background_completed_at` text,
	`is_ask_in_passing` integer DEFAULT false NOT NULL,
	`turn_started_at` text,
	`message_version` integer DEFAULT 0 NOT NULL,
	`message_structure_version` integer DEFAULT 0 NOT NULL,
	`default_device_id` text,
	`oauth_owner_grant_id` text,
	`oauth_provision_key` text,
	`context_project_id` text,
	`oauth_policy_snapshot_json` text,
	`avatar_image_id` text,
	`owner_user_id` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`write_audience` text DEFAULT 'owner' NOT NULL,
	`acl_root_narrator_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fork_message_id`) REFERENCES `narrator_messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`refs_inherited_from`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`oauth_owner_grant_id`) REFERENCES `oauth_grants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`context_project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`acl_root_narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_narrators`("id", "chapter_id", "api_conversation_id", "logical_run_id", "inbox_sequence", "next_seq", "fork_message_id", "type", "subagent_type", "title", "inherit_mode", "parent_narrator_id", "origin_tool_call_id", "subagent_origin_kind", "context_summary", "model", "pending_model_restore", "system_prompt", "permission_mode", "previous_permission_mode", "plan_file_id", "reasoning_effort", "fast_mode", "fast_mode_override", "relaxed_plan", "plan_reflection_auto_approve_override", "danger_reflection_override", "auto_continuation_override", "behavior_fence_interval_override", "tasks_reminder_interval_override", "behavior_fence_attach_override", "message_count", "total_cost_usd", "last_message_at", "status", "substatus", "plan_mode", "cwd", "error_message", "error_retryable", "refs_inherited_from", "refs_backfill_cursor", "enabled_tools", "variant", "traits", "handle", "handle_fold", "is_background", "background_status", "background_result", "background_completed_at", "is_ask_in_passing", "turn_started_at", "message_version", "message_structure_version", "default_device_id", "oauth_owner_grant_id", "oauth_provision_key", "context_project_id", "oauth_policy_snapshot_json", "avatar_image_id", "owner_user_id", "visibility", "write_audience", "acl_root_narrator_id", "created_at", "updated_at") SELECT "id", "chapter_id", "api_conversation_id", "logical_run_id", "inbox_sequence", "next_seq", "fork_message_id", "type", "subagent_type", "title", "inherit_mode", "parent_narrator_id", "origin_tool_call_id", "subagent_origin_kind", "context_summary", "model", "pending_model_restore", "system_prompt", "permission_mode", "previous_permission_mode", "plan_file_id", "reasoning_effort", "fast_mode", "fast_mode_override", "relaxed_plan", "plan_reflection_auto_approve_override", "danger_reflection_override", "auto_continuation_override", "behavior_fence_interval_override", "tasks_reminder_interval_override", "behavior_fence_attach_override", "message_count", "total_cost_usd", "last_message_at", "status", "substatus", "plan_mode", "cwd", "error_message", "error_retryable", "refs_inherited_from", "refs_backfill_cursor", "enabled_tools", "variant", "traits", "handle", "handle_fold", "is_background", "background_status", "background_result", "background_completed_at", "is_ask_in_passing", "turn_started_at", "message_version", "message_structure_version", "default_device_id", "oauth_owner_grant_id", "oauth_provision_key", "context_project_id", "oauth_policy_snapshot_json", "avatar_image_id", "owner_user_id", "visibility", "write_audience", "acl_root_narrator_id", "created_at", "updated_at" FROM `narrators`;--> statement-breakpoint
DROP TABLE `narrators`;--> statement-breakpoint
ALTER TABLE `__new_narrators` RENAME TO `narrators`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_narrators_chapter` ON `narrators` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_narrators_parent` ON `narrators` (`parent_narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_narrators_origin_tool_call` ON `narrators` (`origin_tool_call_id`);--> statement-breakpoint
CREATE INDEX `idx_narrators_owner` ON `narrators` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_narrators_visibility` ON `narrators` (`visibility`);--> statement-breakpoint
CREATE INDEX `idx_narrators_write_audience` ON `narrators` (`write_audience`);--> statement-breakpoint
CREATE INDEX `idx_narrators_acl_root` ON `narrators` (`acl_root_narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_narrators_variant_updated` ON `narrators` (`variant`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_narrators_handle` ON `narrators` (`handle`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_narrators_handle_fold` ON `narrators` (`handle_fold`);--> statement-breakpoint
CREATE INDEX `idx_narrators_context_project` ON `narrators` (`context_project_id`);--> statement-breakpoint
CREATE INDEX `idx_narrators_oauth_owner` ON `narrators` (`oauth_owner_grant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_narrators_oauth_provision` ON `narrators` (`oauth_owner_grant_id`,`oauth_provision_key`);--> statement-breakpoint
CREATE INDEX `idx_narrators_fork_message` ON `narrators` (`fork_message_id`);--> statement-breakpoint
CREATE INDEX `idx_narrators_refs_inherited_from` ON `narrators` (`refs_inherited_from`) WHERE "refs_inherited_from" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_narrators_background_parent_created` ON `narrators` (`parent_narrator_id`,`created_at`,`id`) WHERE "is_background" = 1;--> statement-breakpoint
ALTER TABLE `api_requests` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `api_requests` ADD `agent_label` text;--> statement-breakpoint
ALTER TABLE `api_requests` ADD `cost_status` text;--> statement-breakpoint
ALTER TABLE `api_requests` ADD `cost_missing_fields` text;--> statement-breakpoint
CREATE INDEX `idx_api_requests_user_created` ON `api_requests` (`user_id`,`created_at`,`id`);--> statement-breakpoint
ALTER TABLE `background_tasks` ADD `logical_run_id` text;--> statement-breakpoint
ALTER TABLE `background_tasks` ADD `transfer_task_id` text REFERENCES device_transfer_tasks(id);--> statement-breakpoint
ALTER TABLE `background_tasks` ADD `tool_call_id` text;--> statement-breakpoint
ALTER TABLE `background_tasks` ADD `execution_attempt` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bg_tasks_tool_attempt` ON `background_tasks` (`tool_call_id`,`execution_attempt`);--> statement-breakpoint
CREATE INDEX `idx_bg_tasks_transfer` ON `background_tasks` (`transfer_task_id`);--> statement-breakpoint
CREATE INDEX `idx_bg_tasks_parent_created` ON `background_tasks` (`parent_narrator_id`,`created_at`,`id`);--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `sender_share_id` text REFERENCES narrator_public_shares(id);--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `sender_guest_name` text;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `reply_to_guest_name` text;--> statement-breakpoint
CREATE INDEX `idx_chat_messages_sender_share` ON `chat_messages` (`sender_share_id`);--> statement-breakpoint
ALTER TABLE `credential_usage_totals` ADD `partial_request_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `device_transfer_tasks` ADD `parent_narrator_id` text REFERENCES narrators(id);--> statement-breakpoint
ALTER TABLE `device_transfer_tasks` ADD `tool_use_id` text;--> statement-breakpoint
ALTER TABLE `device_transfer_tasks` ADD `alias` text;--> statement-breakpoint
CREATE INDEX `idx_device_transfer_tasks_parent_narrator` ON `device_transfer_tasks` (`parent_narrator_id`);--> statement-breakpoint
CREATE TABLE `__new_file_attributions` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text DEFAULT 'local' NOT NULL,
	`workspace_path` text NOT NULL,
	`file_path` text NOT NULL,
	`narrator_id` text,
	`user_id` text,
	`subagent_type` text,
	`action` text NOT NULL,
	`tool_name` text,
	`tool_use_id` text,
	`operation_id` text,
	`effect_id` text,
	`scope_id` text,
	`file_key` text,
	`actor_subject_key` text,
	`actor_snapshot_json` text,
	`attribution_grade` text,
	`lines_added` integer,
	`lines_removed` integer,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`narrator_id`) REFERENCES `narrators`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`operation_id`) REFERENCES `file_change_operations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`effect_id`) REFERENCES `file_change_effects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`scope_id`) REFERENCES `file_change_scopes`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_file_attr_line_counts" CHECK(
			("__new_file_attributions"."lines_added" IS NULL OR (typeof("__new_file_attributions"."lines_added") = 'integer' AND "__new_file_attributions"."lines_added" >= 0))
			AND ("__new_file_attributions"."lines_removed" IS NULL OR (typeof("__new_file_attributions"."lines_removed") = 'integer' AND "__new_file_attributions"."lines_removed" >= 0))
		)
);
--> statement-breakpoint
INSERT INTO `__new_file_attributions`("id", "device_id", "workspace_path", "file_path", "narrator_id", "user_id", "subagent_type", "action", "tool_name", "tool_use_id", "operation_id", "effect_id", "scope_id", "file_key", "actor_subject_key", "actor_snapshot_json", "attribution_grade", "lines_added", "lines_removed", "changed_at") SELECT "id", "device_id", "workspace_path", "file_path", "narrator_id", "user_id", "subagent_type", "action", "tool_name", "tool_use_id", "operation_id", "effect_id", "scope_id", "file_key", "actor_subject_key", "actor_snapshot_json", "attribution_grade", "lines_added", "lines_removed", "changed_at" FROM `file_attributions`;--> statement-breakpoint
DROP TABLE `file_attributions`;--> statement-breakpoint
ALTER TABLE `__new_file_attributions` RENAME TO `file_attributions`;--> statement-breakpoint
CREATE INDEX `idx_file_attr_workspace_file` ON `file_attributions` (`workspace_path`,`file_path`,`changed_at`);--> statement-breakpoint
CREATE INDEX `idx_file_attr_device_workspace_file` ON `file_attributions` (`device_id`,`workspace_path`,`file_path`,`changed_at`);--> statement-breakpoint
CREATE INDEX `idx_file_attr_narrator` ON `file_attributions` (`narrator_id`);--> statement-breakpoint
CREATE INDEX `idx_file_attr_workspace` ON `file_attributions` (`workspace_path`,`changed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_file_attr_effect` ON `file_attributions` (`effect_id`);--> statement-breakpoint
CREATE INDEX `idx_file_attr_operation` ON `file_attributions` (`operation_id`);--> statement-breakpoint
CREATE INDEX `idx_file_attr_scope_file` ON `file_attributions` (`scope_id`,`file_key`,`changed_at`,`id`);--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `file_references_json` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `kind` text DEFAULT 'user_input' NOT NULL;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `notice_kind` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `envelope_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `metadata_json` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `source_narrator_id` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `source_tool_call_id` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `source_attempt` integer;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `source_key` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `dedupe_key` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `delivery_id` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `recipient_message_id` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `recipient_ref_id` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `current_message_id` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `content_revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `adopted_revision` integer;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `adopted_at` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `current_revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `current_adopted_revision` integer;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `current_adopted_at` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `receipt_disposition` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `arrival_seq` integer;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `state` text DEFAULT 'queued' NOT NULL;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `claim_token` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `claim_epoch` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `claimed_at` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `claim_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `last_error` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `byte_size` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `projected_byte_size` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `payload_ref_json` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `dedupe_expires_at` text;--> statement-breakpoint
ALTER TABLE `narrator_buffered_messages` ADD `updated_at` text;--> statement-breakpoint
CREATE INDEX `idx_nbm_state_arrival` ON `narrator_buffered_messages` (`narrator_id`,`state`,`arrival_seq`);--> statement-breakpoint
CREATE INDEX `idx_nbm_claim_recovery` ON `narrator_buffered_messages` (`state`,`id`);--> statement-breakpoint
CREATE INDEX `idx_nbm_quota` ON `narrator_buffered_messages` (`narrator_id`,`kind`,`notice_kind`,`state`);--> statement-breakpoint
CREATE INDEX `idx_nbm_legacy` ON `narrator_buffered_messages` (`narrator_id`,`arrival_seq`,`seq`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_nbm_dedupe` ON `narrator_buffered_messages` (`narrator_id`,`dedupe_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_nbm_delivery` ON `narrator_buffered_messages` (`delivery_id`);--> statement-breakpoint
CREATE INDEX `idx_nbm_ref` ON `narrator_buffered_messages` (`narrator_id`,`recipient_ref_id`);--> statement-breakpoint
CREATE INDEX `idx_nbm_reserved` ON `narrator_buffered_messages` (`narrator_id`,`recipient_message_id`);--> statement-breakpoint
CREATE INDEX `idx_nbm_source` ON `narrator_buffered_messages` (`source_narrator_id`,`source_tool_call_id`,`source_attempt`);--> statement-breakpoint
ALTER TABLE `narrator_drafts` ADD `file_references_json` text;--> statement-breakpoint
ALTER TABLE `narrator_message_refs` ADD `injection_consumed_at` integer;--> statement-breakpoint
ALTER TABLE `narrator_message_refs` DROP COLUMN `pruned_percent`;--> statement-breakpoint
ALTER TABLE `narrator_messages` ADD `cost_status` text;--> statement-breakpoint
ALTER TABLE `narrator_messages` ADD `cost_missing_fields` text;--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `stream_completed_at` text;--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `execution_identity_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `execution_origin_tool_call_id` text;--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `execution_attempt` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `execution_segment_id` text;--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `file_change_operation_id` text REFERENCES file_change_operations(id);--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `cost_status` text;--> statement-breakpoint
ALTER TABLE `narrator_tool_calls` ADD `cost_missing_fields` text;--> statement-breakpoint
CREATE INDEX `idx_toolcalls_attempt` ON `narrator_tool_calls` (`narrator_id`,`tool_use_id`,`message_id`,`execution_attempt`);--> statement-breakpoint
CREATE INDEX `idx_toolcalls_file_change_operation` ON `narrator_tool_calls` (`file_change_operation_id`);--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `narrator_font_scale_percent` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `narrator_letter_spacing_percent` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `narrator_line_height_scale_percent` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `narrator_paragraph_scale_percent` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `tutorial_progress` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_recent_tabs` ADD `dir_sort_order` integer;--> statement-breakpoint
ALTER TABLE `workspaces` ADD `layout_revision` integer DEFAULT 0 NOT NULL;