DROP INDEX `idx_blacklist_cmds_narrator_pattern`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_blacklist_cmds_narrator_pattern_unscoped` ON `narrator_blacklist_cmds` (`narrator_id`,`pattern`) WHERE "narrator_blacklist_cmds"."device_scope" is null;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_blacklist_cmds_narrator_pattern_scoped` ON `narrator_blacklist_cmds` (`narrator_id`,`pattern`,`device_scope`) WHERE "narrator_blacklist_cmds"."device_scope" is not null;
