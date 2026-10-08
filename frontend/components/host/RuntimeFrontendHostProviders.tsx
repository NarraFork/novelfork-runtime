import {
	createTheme,
	MantineProvider,
	v8CssVariablesResolver,
} from "@mantine/core";
import "@mantine/core/styles.css";
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { initI18n, type Namespace } from "../../lib/i18n";
import { narratorWSManager } from "../../lib/narrator-ws-manager";
import { queryClient } from "../../lib/query-client";
import { Z } from "../../lib/z-index";
import { ConfirmDialogProvider } from "../common/ConfirmDialogProvider";
import { ImageViewerProvider } from "../common/ImageViewerProvider";
import { EmbeddedPluginPermissionRequestHost } from "./EmbeddedPluginPermissionRequestHost";
import { EmbeddedPluginUiHost } from "./EmbeddedPluginUiHost";

const runtimeTheme = createTheme({
	primaryColor: "indigo",
	defaultRadius: "sm",
});

const i18nLoads = new Map<string, Promise<unknown>>();

// Transport ownership uses the Runtime's shared connection lease
// (`narratorWSManager.acquireConnection()`), the same mechanism `AppRootLayout`
// uses. An embedded host has no `AppRootLayout`, so the embedded surface must
// take a lease itself: registering a listener never opens a socket, which is why
// streaming frames silently never arrived. Sharing one lease counter keeps a
// standalone shell and embedded surfaces from disconnecting each other.

function ensureRuntimeI18n(namespaces: readonly Namespace[]): Promise<unknown> {
	const normalized = [...new Set(namespaces)].sort();
	const key = normalized.join("\u0000");
	let pending = i18nLoads.get(key);
	if (!pending) {
		pending = initI18n(normalized);
		i18nLoads.set(key, pending);
	}
	return pending;
}

export interface RuntimeFrontendHostProvidersProps {
	readonly namespaces: readonly Namespace[];
	readonly loadingFallback?: ReactNode;
	/**
	 * The host application's resolved color scheme. When given, the embedded
	 * surface follows the host's own light/dark switch instead of the OS
	 * preference, so the two halves of the page never disagree.
	 */
	readonly colorScheme?: "light" | "dark";
	readonly children: ReactNode;
}

/**
 * Supplies the Runtime-owned frontend providers required when a host application
 * embeds an isolated Runtime surface. Product code stays outside this component.
 */
export function RuntimeFrontendHostProviders({
	namespaces,
	loadingFallback,
	colorScheme,
	children,
}: RuntimeFrontendHostProvidersProps): ReactNode {
	const namespaceKey = namespaces.join("\u0000");
	const stableNamespaces = useMemo(() => [...namespaces], [namespaceKey]);
	const [ready, setReady] = useState(false);

	useEffect(() => narratorWSManager.acquireConnection(), []);

	useEffect(() => {
		let active = true;
		setReady(false);
		void ensureRuntimeI18n(stableNamespaces).finally(() => {
			if (active) setReady(true);
		});
		return () => {
			active = false;
		};
	}, [stableNamespaces]);

	if (!ready) return loadingFallback ?? null;

	return (
		<MantineProvider
			theme={runtimeTheme}
			defaultColorScheme="auto"
			forceColorScheme={colorScheme}
			cssVariablesResolver={v8CssVariablesResolver}
		>
			<ConfirmDialogProvider>
				<ImageViewerProvider>
					<Notifications
						position="top-right"
						zIndex={Z.toast}
						pauseResetOnHover="notification"
					/>
					<QueryClientProvider client={queryClient}>
						<EmbeddedPluginUiHost>
							{children}
							<EmbeddedPluginPermissionRequestHost />
						</EmbeddedPluginUiHost>
					</QueryClientProvider>
				</ImageViewerProvider>
			</ConfirmDialogProvider>
		</MantineProvider>
	);
}
