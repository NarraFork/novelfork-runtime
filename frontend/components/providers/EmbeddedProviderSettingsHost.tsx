import type { ReactNode } from "react";
import { RuntimeFrontendHostProviders } from "../host/RuntimeFrontendHostProviders";
import { SettingsProvidersPage } from "../../routes/settings/providers";

export interface EmbeddedProviderSettingsHostProps {
	readonly loadingFallback?: ReactNode;
	/** Host-resolved color scheme; see RuntimeFrontendHostProviders. */
	readonly colorScheme?: "light" | "dark";
}

/**
 * Runtime-owned Provider settings surface for product shells.
 *
 * The host supplies only the Runtime frontend providers; all provider state,
 * protocol-specific UI, OAuth flows, model inventory and account-pool actions
 * remain owned by the native Runtime settings page.
 */
export function EmbeddedProviderSettingsHost({
	loadingFallback,
	colorScheme,
}: EmbeddedProviderSettingsHostProps): ReactNode {
	return (
		<RuntimeFrontendHostProviders
			namespaces={["common", "settings"]}
			colorScheme={colorScheme}
			loadingFallback={loadingFallback ?? <div role="status">正在加载原生 AI 供应商设置…</div>}
		>
			<div data-testid="native-runtime-provider-settings" className="min-h-0 w-full">
				<SettingsProvidersPage />
			</div>
		</RuntimeFrontendHostProviders>
	);
}
