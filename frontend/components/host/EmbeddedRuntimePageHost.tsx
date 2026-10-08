import { DatesProvider } from "@mantine/dates";
import type { ReactNode } from "react";
import { routeTree } from "../../routeTree.gen";
import { EmbeddedRuntimePage, type EmbeddedRuntimePageOptions } from "./EmbeddedRuntimePage";
import { RuntimeFrontendHostProviders } from "./RuntimeFrontendHostProviders";

export interface EmbeddedRuntimePageHostProps extends EmbeddedRuntimePageOptions {
	readonly loadingFallback?: ReactNode;
	/** Host-resolved color scheme; see RuntimeFrontendHostProviders. */
	readonly colorScheme?: "light" | "dark";
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
	...page
}: EmbeddedRuntimePageHostProps): ReactNode {
	return (
		<RuntimeFrontendHostProviders
			namespaces={["common"]}
			colorScheme={colorScheme}
			loadingFallback={loadingFallback ?? <div role="status">正在加载 Runtime 页面…</div>}
		>
			<DatesProvider settings={{ firstDayOfWeek: 1 }}>
				<div data-testid="native-runtime-page" className="min-h-0 w-full">
					<EmbeddedRuntimePage routeTree={routeTree} {...page} />
				</div>
			</DatesProvider>
		</RuntimeFrontendHostProviders>
	);
}
