import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import {
	createRootRouteWithContext,
	createRoute,
	Outlet,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { parseHTML } from "linkedom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EmbeddedRuntimePage } from "./EmbeddedRuntimePage";

const DOM_KEYS = ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "IS_REACT_ACT_ENVIRONMENT"] as const;
let restore: (() => void) | undefined;
let root: Root | undefined;
let container: HTMLElement | undefined;

beforeEach(() => {
	const previous = new Map(DOM_KEYS.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
	const { window } = parseHTML("<!doctype html><html><body><div id=root></div></body></html>");
	const values: Record<string, unknown> = {
		window,
		document: window.document,
		navigator: window.navigator,
		HTMLElement: window.HTMLElement,
		Element: window.Element,
		Node: window.Node,
		Event: window.Event,
		IS_REACT_ACT_ENVIRONMENT: true,
	};
	Object.defineProperty(window, "location", { configurable: true, value: new URL("http://localhost/") });
	for (const key of DOM_KEYS)
		Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: values[key] });
	restore = () => {
		for (const [key, descriptor] of previous) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else delete (globalThis as Record<string, unknown>)[key];
		}
	};
	container = window.document.getElementById("root") as unknown as HTMLElement;
	root = createRoot(container);
});

afterEach(async () => {
	await act(async () => root?.unmount());
	root = undefined;
	restore?.();
});

function routeTree() {
	const rootRoute = createRootRouteWithContext<{ embeddedPage?: boolean }>()({
		component: function RootComponent() {
			const embedded = rootRoute.useRouteContext({ select: (context) => context.embeddedPage === true });
			return embedded ? <Outlet /> : <div data-shell>app shell</div>;
		},
	});
	const list = createRoute({
		getParentRoute: () => rootRoute,
		path: "/knowledge",
		component: function KnowledgeList() {
			const navigate = useNavigate();
			return (
				<div data-page="list">
					<button type="button" data-go="entry" onClick={() => void navigate({ to: "/knowledge/$entryId", params: { entryId: "abc" } })} />
					<button type="button" data-go="narrator" onClick={() => void navigate({ to: "/narrators/$narratorId", params: { narratorId: "n1" } })} />
					<a href="/knowledge/doc" data-go="anchor-in">in</a>
					<a href="/narrators/n2" data-go="anchor-out">out</a>
					<a href="https://example.com/x" data-go="anchor-external">external</a>
				</div>
			);
		},
	});
	const entry = createRoute({
		getParentRoute: () => rootRoute,
		path: "/knowledge/$entryId",
		component: function KnowledgeEntry() {
			const { entryId } = useParams({ strict: false }) as { entryId: string };
			const navigate = useNavigate();
			return (
				<div data-page={`entry:${entryId}`}>
					<button type="button" data-go="narrator" onClick={() => void navigate({ to: "/narrators/$narratorId", params: { narratorId: "n1" } })} />
				</div>
			);
		},
	});
	const narrator = createRoute({ getParentRoute: () => rootRoute, path: "/narrators/$narratorId", component: () => <div data-page="narrator" /> });
	return rootRoute.addChildren([list, entry, narrator]);
}

async function settle() {
	for (let i = 0; i < 5; i++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

const page = () => container?.querySelector("[data-page]")?.getAttribute("data-page") ?? null;
const click = async (selector: string) => {
	await act(async () => (container?.querySelector(selector) as unknown as { click(): void }).click());
	await settle();
};

test("renders the page without the app shell and keeps navigation inside its scope", async () => {
	const tree = routeTree();
	const onPathChange = mock((_path: string) => {});
	const onNavigateOutside = mock((_path: string) => {});
	const isEmbeddedPath = (pathname: string) => pathname === "/knowledge" || pathname.startsWith("/knowledge/");
	const render = (path: string) =>
		act(async () =>
			root?.render(
				<EmbeddedRuntimePage
					routeTree={tree}
					path={path}
					isEmbeddedPath={isEmbeddedPath}
					onPathChange={onPathChange}
					onNavigateOutside={onNavigateOutside}
				/>,
			),
		);

	await render("/knowledge");
	await settle();
	expect(container?.querySelector("[data-shell]")).toBeNull();
	expect(page()).toBe("list");

	await click("[data-go=entry]");
	expect(page()).toBe("entry:abc");
	expect(onPathChange).toHaveBeenLastCalledWith("/knowledge/abc");

	// Leaving the scope is refused and handed to the host; the page stays put.
	await click("[data-go=narrator]");
	expect(page()).toBe("entry:abc");
	expect(onNavigateOutside).toHaveBeenCalledWith("/narrators/n1");

	// Plain same-origin anchors go through the embedded router and its scope check too.
	await render("/knowledge/abc");
	await render("/knowledge");
	await settle();
	expect(page()).toBe("list");
	await click("[data-go=anchor-out]");
	expect(page()).toBe("list");
	expect(onNavigateOutside).toHaveBeenLastCalledWith("/narrators/n2");
	await click("[data-go=anchor-external]");
	expect(page()).toBe("list");
	expect(onNavigateOutside).toHaveBeenCalledTimes(2);
	await click("[data-go=anchor-in]");
	expect(page()).toBe("entry:doc");
	expect(onPathChange).toHaveBeenLastCalledWith("/knowledge/doc");

	// The host mirrors the reported path into its URL (a no-op for the page)…
	await render("/knowledge/abc");
	await settle();
	expect(page()).toBe("entry:abc");
	// …and its back button then hands an older path back, which moves the page.
	await render("/knowledge");
	await settle();
	expect(page()).toBe("list");
});
