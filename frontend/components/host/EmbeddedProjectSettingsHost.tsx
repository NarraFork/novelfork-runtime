import type { ReactNode } from "react";
import { Divider, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { RuntimeFrontendHostProviders } from "./RuntimeFrontendHostProviders";
import { ProjectRoutinesPanel } from "../project/ProjectRoutinesModal";
import { ProjectSkillsManager } from "../project/ProjectSkillsManager";

export interface EmbeddedProjectSettingsHostProps {
	readonly projectId: string;
	readonly loadingFallback?: ReactNode;
	/** Host-resolved color scheme; see RuntimeFrontendHostProviders. */
	readonly colorScheme?: "light" | "dark";
}

/**
 * Runtime-owned project-level settings surface for product shells.
 *
 * The same pieces the project page opens in modals, rendered inline: project skills and
 * the project's positions on routines and optional tools. The host supplies only the
 * Runtime frontend providers — storage, capability gates and every write stay Runtime's.
 *
 * Deliberately absent: MCP permissions, hooks and prompt/rule files have no project-level
 * surface in Runtime today (their backends accept a project scope, their UIs only offer
 * the global one). Embedding a product-side copy of those would be a second implementation
 * of Runtime's own state, so they stay out until an upstream project-level surface exists.
 */
export function EmbeddedProjectSettingsHost({
	projectId,
	loadingFallback,
	colorScheme,
}: EmbeddedProjectSettingsHostProps): ReactNode {
	const { t } = useTranslation("projects");

	return (
		<RuntimeFrontendHostProviders
			namespaces={["common", "projects", "settings", "routines"]}
			colorScheme={colorScheme}
			loadingFallback={loadingFallback ?? <div role="status">正在加载 Runtime 项目设置…</div>}
		>
			<div data-testid="native-runtime-project-settings" className="min-h-0 w-full">
				<Stack gap="md">
					<div>
						<Title order={4}>{t("skillsTitle")}</Title>
						<Text size="sm" c="dimmed">
							{t("skillsDesc")}
						</Text>
					</div>
					<ProjectSkillsManager projectId={projectId} enabled />
					<Divider my="md" />
					<div>
						<Title order={4}>{t("routinesTitle")}</Title>
					</div>
					<ProjectRoutinesPanel projectId={projectId} enabled />
				</Stack>
			</div>
		</RuntimeFrontendHostProviders>
	);
}
