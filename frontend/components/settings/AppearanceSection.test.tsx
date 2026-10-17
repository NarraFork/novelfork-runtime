import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { MantineProvider } from "@mantine/core";
import { parseHTML } from "linkedom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const originalI18n = { ...(await import("react-i18next")) };
const originalThemes = { ...(await import("../../hooks/usePluginThemes")) };
const originalSwitcher = { ...(await import("../ThemeSwitcher")) };
const originalLanguage = { ...(await import("../LanguageSwitcher")) };

const pluginThemes = [
	{ pluginId: "p.one", themeId: "dark-ink", title: "Dark Ink", enabled: true },
];

mock.module("react-i18next", () => ({
	...originalI18n,
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: "zh", resolvedLanguage: "zh" },
	}),
}));
mock.module("../../hooks/usePluginThemes", () => ({
	...originalThemes,
	pluginThemeKey: (item: { pluginId: string; themeId: string }) => `${item.pluginId}__${item.themeId}`,
	usePluginAvailableThemes: () => ({
		themes: pluginThemes,
		isFetching: false,
		error: null,
		setEnabled: async () => {},
		isMutating: false,
	}),
	usePluginThemePref: () => [null, () => {}],
}));
mock.module("../ThemeSwitcher", () => ({ ThemeSwitcher: () => null }));
mock.module("../LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));

const { AppearanceSection } = await import("./AppearanceSection");

const globals = new Map<string, PropertyDescriptor | undefined>();
function install(key: string, value: unknown) {
	if (!globals.has(key)) globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
	Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}
function restoreGlobals() {
	for (const [key, descriptor] of globals) {
		if (descriptor) Object.defineProperty(globalThis, key, descriptor);
		else delete (globalThis as Record<string, unknown>)[key];
	}
	globals.clear();
}

const { window } = parseHTML("<!doctype html><html><body></body></html>");
install("window", window);
install("document", window.document);
install("navigator", window.navigator);
install("Document", window.Document);
install("HTMLElement", window.HTMLElement);
install("Element", window.Element);
install("Node", window.Node);
install("ShadowRoot", window.ShadowRoot);
install("MutationObserver", window.MutationObserver ?? class { observe() {} disconnect() {} takeRecords() { return []; } });
class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
install("ResizeObserver", ResizeObserverStub);
install("IS_REACT_ACT_ENVIRONMENT", true);
install("requestAnimationFrame", (callback: (time: number) => void) => setTimeout(() => callback(Date.now()), 0));
install("cancelAnimationFrame", (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
const computedStyleStub = (() => new Proxy({}, { get: () => "" })) as unknown as typeof window.getComputedStyle;
install("getComputedStyle", (window.getComputedStyle ?? computedStyleStub).bind(window));
install("matchMedia", () => ({
	matches: false,
	addEventListener() {},
	removeEventListener() {},
	addListener() {},
	removeListener() {},
}));

let root: Root | null = null;

beforeEach(() => {
	window.document.body.innerHTML = "<div id=\"root\"></div>";
});

afterAll(async () => {
	root?.unmount();
	root = null;
	await new Promise((resolve) => setTimeout(resolve, 0));
	mock.restore();
	restoreGlobals();
});

function baseProps(hidePluginThemes?: boolean) {
	return {
		hidePluginThemes,
		userPrefs: {},
		updateUserPref: { mutate: () => {}, isPending: false } as unknown as Parameters<typeof AppearanceSection>[0]["updateUserPref"],
		oledMode: false,
		setOledMode: () => {},
		isFullscreen: false,
		setIsFullscreen: () => {},
		wakeLock: false,
		setWakeLock: () => {},
		advancedAnim: false,
		setAdvancedAnim: () => {},
		blurInMs: 400,
		setBlurInMs: () => {},
		streamTokenMs: 0,
		setStreamTokenMs: () => {},
		expandReasoning: false,
		setExpandReasoning: () => {},
		centeredColumn: false,
		setCenteredColumn: () => {},
		lodAltGesture: false,
		setLodAltGesture: () => {},
	};
}

async function render(hidePluginThemes?: boolean): Promise<string> {
	const container = window.document.getElementById("root")!;
	root = createRoot(container);
	await act(async () => {
		root!.render(
			<MantineProvider>
				<AppearanceSection {...baseProps(hidePluginThemes)} />
			</MantineProvider>,
		);
	});
	return container.textContent ?? "";
}

describe("AppearanceSection hidePluginThemes", () => {
	test("默认显示插件主题下拉框（独立运行 Runtime 不变）", async () => {
		const text = await render(undefined);
		expect(text).toContain("pluginTheme");
	});

	test("显式关闭时同样显示", async () => {
		const text = await render(false);
		expect(text).toContain("pluginTheme");
	});

	test("嵌入产品（hidePluginThemes 为真）时不渲染插件主题下拉框", async () => {
		const text = await render(true);
		expect(text).not.toContain("pluginTheme");
		// 其余 Runtime 外观设置仍在
		expect(text).toContain("oledMode");
	});
});
