import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { parseHTML } from "linkedom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const marker = "PLUGIN_PERMISSION_HOST";

mock.module("../plugins-admin/PluginPermissionRequestHost", () => ({
	PluginPermissionRequestHost: function MockHost() {
		return <div data-testid="permission-host">{marker}</div>;
	},
}));

import { EmbeddedPluginPermissionRequestHost } from "./EmbeddedPluginPermissionRequestHost";

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
	for (const key of DOM_KEYS) {
		Object.defineProperty(globalThis, key, { value: values[key], configurable: true, writable: true });
	}
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	restore = () => {
		for (const key of DOM_KEYS) {
			const descriptor = previous.get(key);
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		}
	};
});

afterEach(() => {
	const mounted = root;
	if (mounted) act(() => mounted.unmount());
	root = undefined;
	container?.remove();
	container = undefined;
	restore?.();
	restore = undefined;
});

async function flush(): Promise<void> {
	await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
	await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

test("同一时刻只有队首宿主渲染权限弹窗；队首卸载后最早剩余宿主递补", async () => {
	const first = createRoot(container!.appendChild(document.createElement("div")));
	const second = createRoot(container!.appendChild(document.createElement("div")));

	act(() => {
		first.render(<EmbeddedPluginPermissionRequestHost />);
		second.render(<EmbeddedPluginPermissionRequestHost />);
	});
	await flush();

	const hosts = () => document.querySelectorAll("[data-testid=permission-host]");
	expect(hosts()).toHaveLength(1);

	act(() => first.unmount());
	await flush();

	expect(hosts()).toHaveLength(1);
});
