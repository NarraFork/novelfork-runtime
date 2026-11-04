import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { RootErrorBoundary, RootLayout } from "../components/AppRootLayout";
import { ensureI18nNamespaces, getNamespacesForPath } from "../lib/i18n";

interface RouterContext {
	queryClient: QueryClient;
	/**
	 * Set by EmbeddedRuntimePageHost: a product shell renders one Runtime page inside
	 * its own chrome, so the root renders the page alone, without the app shell.
	 */
	embeddedPage?: boolean;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	beforeLoad: ({ location }) => {
		// Preload on navigation intent without holding the route transition hostage.
		// The render gate owns correctness and surfaces any actual load failure.
		void ensureI18nNamespaces(getNamespacesForPath(location.pathname)).catch(() => {});
	},
	component: RootRouteComponent,
	errorComponent: RootErrorBoundary,
});

function RootRouteComponent() {
	const embeddedPage = Route.useRouteContext({ select: (context) => context.embeddedPage === true });
	return embeddedPage ? <Outlet /> : <RootLayout />;
}
