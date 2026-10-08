import { useMemo, type ReactNode } from "react";
import { queryClient } from "../../lib/query-client";
import {
	PluginUiRuntimeProvider,
	requestPluginUiBackend,
	resolvePluginUiContribution,
} from "../plugins";
import { createAppPluginHostLocal } from "../plugins/app-host-local";
import { handlePluginUiNotification } from "../plugins/notifications";

/**
 * Plugin React runtime for an embedded surface (narrator panel / embedded settings).
 *
 * RuntimeFrontendHostProviders gives an embedded surface everything the Runtime
 * frontend needs *except* the plugin runtime (`PluginDockPanel` in the narrator
 * dock, or plugin settings panels on an embedded Runtime settings page). Each
 * embedded surface wraps its own host: the plugin contribution store is module-
 * scoped and shared across hosts, while each surface owns its panel RPC session
 * pool — opening the same contribution twice (once per surface) would otherwise
 * fork a host-local session the other surface can't see.
 */
export function EmbeddedPluginUiHost({ children }: { readonly children: ReactNode }): ReactNode {
	const hostLocal = useMemo(() => createAppPluginHostLocal({ queryClient }), []);

	return (
		<PluginUiRuntimeProvider
			resolveContribution={resolvePluginUiContribution}
			onBackendRequest={requestPluginUiBackend}
			hostLocal={hostLocal}
			onNotification={(_params, notification) =>
				handlePluginUiNotification(notification, queryClient)
			}
		>
			{children}
		</PluginUiRuntimeProvider>
	);
}
