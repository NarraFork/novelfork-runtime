import type { AnyRoute } from "@tanstack/react-router";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { queryClient } from "../../lib/query-client";
import { RouteChunkErrorBoundary, RoutePendingIndicator } from "../common/RouteChunkErrorBoundary";

export interface EmbeddedRuntimePageOptions {
	/** Runtime path to show, with search and hash (e.g. "/knowledge/abc?tab=links"). */
	readonly path: string;
	/** Whether the page may navigate to this pathname itself; anything else goes to the host. */
	readonly isEmbeddedPath: (pathname: string) => boolean;
	/** The page navigated within its scope; hosts mirror this into their own URL. */
	readonly onPathChange?: (path: string) => void;
	/** The page tried to leave its scope (a narrator link, the chat page…); the host decides. */
	readonly onNavigateOutside?: (path: string) => void;
}

/**
 * One Runtime page on its own router: memory history, so the product shell's URL
 * and browser history stay the host's, and `embeddedPage` in the router context so
 * the root route renders the page without the Runtime app shell.
 *
 * Takes the route tree as a parameter so it can be exercised without generated code;
 * EmbeddedRuntimePageHost binds the Runtime's real tree.
 */
export function EmbeddedRuntimePage({
	routeTree,
	path,
	isEmbeddedPath,
	onPathChange,
	onNavigateOutside,
}: EmbeddedRuntimePageOptions & { readonly routeTree: AnyRoute }): ReactNode {
	const latest = useRef({ isEmbeddedPath, onPathChange, onNavigateOutside });
	latest.current = { isEmbeddedPath, onPathChange, onNavigateOutside };
	const [router] = useState(() => {
		const history = createMemoryHistory({ initialEntries: [path] });
		history.block({
			blockerFn: ({ nextLocation }) => {
				if (latest.current.isEmbeddedPath(nextLocation.pathname)) return false;
				latest.current.onNavigateOutside?.(nextLocation.href);
				return true;
			},
		});
		return createRouter({
			routeTree,
			history,
			context: { queryClient, embeddedPage: true },
			defaultErrorComponent: RouteChunkErrorBoundary,
			defaultPendingComponent: RoutePendingIndicator,
			defaultPendingMs: 400,
			defaultPendingMinMs: 300,
		});
	});

	useEffect(
		() => router.history.subscribe(({ location }) => latest.current.onPathChange?.(location.href)),
		[router],
	);
	// Host-driven navigation (back/forward in the product shell) moves the embedded page.
	useEffect(() => {
		if (router.history.location.href !== path)
			router.history.push(path, undefined, { ignoreBlocker: true });
	}, [router, path]);

	// Runtime pages also use plain <a href> (learning-center actions, docs). Unhandled, the
	// browser loads that path as a whole new document; route same-origin ones through the
	// embedded router instead, so the scope check and onNavigateOutside apply to them too.
	// Router <Link>s have already called preventDefault by the time this bubbles up.
	const onClick = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if (event.defaultPrevented || (event.button ?? 0) !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const anchor = (event.target as Element | null)?.closest?.("a[href]");
			if (!anchor || anchor.hasAttribute("download")) return;
			const target = anchor.getAttribute("target");
			if (target && target !== "_self") return;
			const href = anchor.getAttribute("href");
			if (!href || href.startsWith("#")) return;
			let url: URL;
			try {
				url = new URL(href, window.location.href);
			} catch {
				return;
			}
			if (url.origin !== window.location.origin) return;
			event.preventDefault();
			void router.navigate({ href: `${url.pathname}${url.search}${url.hash}` });
		},
		[router],
	);

	return (
		<div style={{ display: "contents" }} onClick={onClick}>
			<RouterProvider router={router} />
		</div>
	);
}
