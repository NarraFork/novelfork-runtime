import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { parseHTML } from "linkedom";
import { createRoot, type Root } from "react-dom/client";

// An embedded host has no `AppRootLayout`, so the embedded surface itself must
// take a shared-transport lease — merely registering a listener never opens a
// socket and streaming frames never arrive. These tests pin that contract:
// `acquireConnection()` on mount, its release callback on unmount.
const release = mock(() => {});
const mocks = {
	acquireConnection: mock(() => release),
};

mock.module("../../lib/narrator-ws-manager", () => ({
	narratorWSManager: {
		acquireConnection: mocks.acquireConnection,
	},
}));

mock.module("../../lib/i18n", () => ({
	default: {
		language: "en",
		t: (key: string) => key,
		changeLanguage: async () => undefined,
		on() {},
		off() {},
	},
	initI18n: async () => undefined,
	// 嵌插件 runtime 的图谱（PluginUiRuntimeProvider → plugins/*）也按同一路径导出这两个函数；
	// mock 缺 named export 会在加载链路直接炸，与其余 i18n 工具函数同样按路径给。
	getInitialNamespaces: () => ["common"],
	getNamespacesForPath: () => ["common"],
}));

// 嵌插件 runtime（EmbeddedPluginUiHost → PluginUiRuntimeProvider）挂载时会做贡献
// 同步；测试环境没有 Runtime 后端，按上游 PluginSettingsSurfacePanel.test 同样的
// mock 干掉贡献刷新周期，不实际打 API。
mock.module("../plugins/registry", () => ({
	syncPluginUiContributions: () => Promise.resolve(0),
	resolvePluginUiContribution: () => undefined,
	resolvePluginUiContributionDetailed: () => undefined,
	hasPluginUiContribution: () => false,
	registerPluginUiContribution: () => () => {},
	clearPluginUiContributions: () => {},
	invalidatePluginUiContributions: () => {},
	applyPluginUiContributionItems: () => {},
}));

// Mantine / PluginUiRuntimeProvider 的观察者接 jsdom：宿主测试同上游 plugin settings 测试一样手补两个最小 polyfill。
class TestResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}
class TestMutationObserver {
	observe() {}
	disconnect() {}
	takeRecords(): unknown[] {
		return [];
	}
}

function memoryStorage(): Storage {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => void store.set(key, String(value)),
		removeItem: (key: string) => void store.delete(key),
		clear: () => store.clear(),
		key: (index: number) => [...store.keys()][index] ?? null,
		get length() {
			return store.size;
		},
	} as Storage;
}

const { RuntimeFrontendHostProviders } = await import(
	"./RuntimeFrontendHostProviders"
);

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let secondRoot: Root | undefined;
let secondContainer: HTMLDivElement | undefined;

function installDom() {
	const { window } = parseHTML(
		"<!doctype html><html><head></head><body></body></html>",
	);
	const matchMedia = (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener() {},
		removeListener() {},
		addEventListener() {},
		removeEventListener() {},
		dispatchEvent: () => false,
	});

	Object.assign(window, {
		matchMedia,
		localStorage: memoryStorage(),
		MutationObserver: TestMutationObserver,
		ResizeObserver: TestResizeObserver,
		requestAnimationFrame: (callback: FrameRequestCallback) =>
			setTimeout(callback, 0),
		cancelAnimationFrame: (id: number) => clearTimeout(id),
	});
	Object.assign(globalThis, {
		window,
		document: window.document,
		navigator: window.navigator,
		Event: window.Event,
		HTMLElement: window.HTMLElement,
		Element: window.Element,
		Node: window.Node,
		Text: window.Text,
		matchMedia,
		requestAnimationFrame: window.requestAnimationFrame,
		cancelAnimationFrame: window.cancelAnimationFrame,
		getComputedStyle:
			window.getComputedStyle?.bind(window) ??
			(() => ({
				getPropertyValue: () => "",
			})),
		IS_REACT_ACT_ENVIRONMENT: false,
	});
}

async function tick() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("RuntimeFrontendHostProviders", () => {
	beforeEach(() => {
		installDom();
		mocks.acquireConnection.mockClear();
		release.mockClear();
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(() => {
		root?.unmount();
		container?.remove();
		secondRoot?.unmount();
		secondContainer?.remove();
		root = undefined;
		container = undefined;
		secondRoot = undefined;
		secondContainer = undefined;
	});

	test("opens the shared narrator transport so streaming frames reach an embedded surface", async () => {
		if (!root || !container) throw new Error("test root not initialized");
		root.render(
			<RuntimeFrontendHostProviders namespaces={["common"]}>
				<div data-testid="embedded-child">ready</div>
			</RuntimeFrontendHostProviders>,
		);

		await tick();
		await tick();

		expect(mocks.acquireConnection).toHaveBeenCalledTimes(1);
		expect(release).not.toHaveBeenCalled();
		expect(
			container.querySelector('[data-testid="embedded-child"]')?.textContent,
		).toBe("ready");

		root.unmount();
		root = undefined;
		expect(release).toHaveBeenCalledTimes(1);
	});

	test("takes one lease per embedded surface so the shared socket survives a sibling unmount", async () => {
		if (!root || !container) throw new Error("test root not initialized");
		secondContainer = document.createElement("div");
		document.body.appendChild(secondContainer);
		secondRoot = createRoot(secondContainer);

		root.render(
			<RuntimeFrontendHostProviders namespaces={["common"]}>
				<div>first</div>
			</RuntimeFrontendHostProviders>,
		);
		secondRoot.render(
			<RuntimeFrontendHostProviders namespaces={["common"]}>
				<div>second</div>
			</RuntimeFrontendHostProviders>,
		);

		await tick();
		await tick();

		// Two independent leases; the manager's own counter keeps the socket open.
		expect(mocks.acquireConnection).toHaveBeenCalledTimes(2);
		expect(release).not.toHaveBeenCalled();

		root.unmount();
		root = undefined;
		expect(release).toHaveBeenCalledTimes(1);

		secondRoot.unmount();
		secondRoot = undefined;
		expect(release).toHaveBeenCalledTimes(2);
	});

	test("follows the host's color scheme instead of the OS preference when one is given", async () => {
		if (!root || !container) throw new Error("test root not initialized");
		// matchMedia reports light; the host says dark.
		root.render(
			<RuntimeFrontendHostProviders namespaces={["common"]} colorScheme="dark">
				<div>dark host</div>
			</RuntimeFrontendHostProviders>,
		);
		await tick();
		await tick();
		expect(document.documentElement.getAttribute("data-mantine-color-scheme")).toBe("dark");

		root.render(
			<RuntimeFrontendHostProviders namespaces={["common"]} colorScheme="light">
				<div>light host</div>
			</RuntimeFrontendHostProviders>,
		);
		await tick();
		await tick();
		expect(document.documentElement.getAttribute("data-mantine-color-scheme")).toBe("light");
	});
});
