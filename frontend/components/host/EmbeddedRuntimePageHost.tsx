import { DatesProvider } from "@mantine/dates";
import type { ReactNode } from "react";
import { type SettingsHostExtension, SettingsHostExtensionProvider } from "../../lib/settings-host-extension";
import { routeTree } from "../../routeTree.gen";
import { EmbeddedRuntimePage, type EmbeddedRuntimePageOptions } from "./EmbeddedRuntimePage";
import { RuntimeFrontendHostProviders } from "./RuntimeFrontendHostProviders";

export interface EmbeddedRuntimePageHostProps extends EmbeddedRuntimePageOptions {
	readonly loadingFallback?: ReactNode;
	/** Host-resolved color scheme; see RuntimeFrontendHostProviders. */
	readonly colorScheme?: "light" | "dark";
	/** Product settings merged into the native settings page; see settings-host-extension. */
	readonly hostExtension?: SettingsHostExtension;
}

/**
 * A native Runtime page (settings, routines, scheduled tasks, knowledge, search, learn…)
 * inside a product shell. The page, its data and its actions stay Runtime-owned; the
 * host only chooses the path and decides where navigation outside the page goes.
 *
 * Not provided here: the app-shell plugin runtime (plugin React settings views) and the
 * app-shell global hosts (setup wizard, plugin permission prompts).
 */
export function EmbeddedRuntimePageHost({
	loadingFallback,
	colorScheme,
	hostExtension,
	...page
}: EmbeddedRuntimePageHostProps): ReactNode {
	return (
		<RuntimeFrontendHostProviders
			namespaces={["common"]}
			colorScheme={colorScheme}
			loadingFallback={loadingFallback ?? <div role="status">正在加载 Runtime 页面…</div>}
		>
			<DatesProvider settings={{ firstDayOfWeek: 1 }}>
				<SettingsHostExtensionProvider value={hostExtension}>
					<div data-testid="native-runtime-page" className="min-h-0 w-full">
						<EmbeddedRuntimePage routeTree={routeTree} {...page} />
					</div>
				</SettingsHostExtensionProvider>
			</DatesProvider>
		</RuntimeFrontendHostProviders>
	);
}
