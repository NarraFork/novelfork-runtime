import { afterEach, describe, expect, test } from "bun:test";
import { openFrontendOnce } from "../open-frontend";
import { settings } from "../settings";
import { registerRuntimeStartupHooks, resetRuntimeStartupHooksForTests } from "../startup-hooks";

const originalMode = settings.server.openBrowser;

afterEach(() => {
	resetRuntimeStartupHooksForTests();
	settings.server.openBrowser = originalMode;
});

describe("openFrontendOnce with an embedding host", () => {
	test("leaves the automatic open to a host that opens its own window", () => {
		// 设置被重载回 "browser"（或宿主改的是另一份设置实例）时也不能再开第二个窗口。
		settings.server.openBrowser = "browser";
		registerRuntimeStartupHooks({ onStartupPageListening: () => true, onServerListening() {} });
		expect(openFrontendOnce("http://localhost:4613")).toBe(false);
		expect(openFrontendOnce("http://[::1]:4613")).toBe(false);
	});

	test('without hooks, "off" still stops the automatic open', () => {
		settings.server.openBrowser = "off";
		expect(openFrontendOnce("http://localhost:4613")).toBe(false);
	});
});
