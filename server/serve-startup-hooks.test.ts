import { afterAll, afterEach, expect, mock, spyOn, test } from "bun:test";
import { registerRuntimeStartupHooks, resetRuntimeStartupHooksForTests } from "./lib/startup-hooks";
import { InstanceLockedError } from "./lib/startup-status/startup-problems";

// NovelFork fork layer: an embedding host takes part in startup through lib/startup-hooks.
const events: string[] = [];
const shown: { message: { en: string; zh: string } }[] = [];
let statusListening = true;
mock.module("./lib/runtime-target", () => ({
	IS_LOCAL_RUNTIME: true,
	RUNTIME_BUILD_ID: "startup-hooks-test",
	isCompiledRuntime: () => false,
}));
mock.module("./lib/version", () => ({ APP_VERSION: "startup-hooks-test" }));
mock.module("./lib/settings", () => ({
	settings: { server: { host: "127.0.0.1", port: 7779, openBrowser: "off" }, branding: {} },
}));
mock.module("./lib/manager-control-server", () => ({
	resolveManagerListenHost: async (host: string) => host,
}));
mock.module("./lib/windows-child-job", () => ({ initWindowsChildJob() {} }));
mock.module("./lib/hot-safe", () => ({ hotOnce: () => true }));
mock.module("./lib/open-frontend", () => ({
	openFrontendOnce() {
		events.push("runtime-open");
		return false;
	},
}));
mock.module("./lib/startup-status", () => ({
	startStartupStatus: async () => {
		events.push("status-page");
		return statusListening;
	},
	showStartupProblem: async (problem: { message: { en: string; zh: string } }) => {
		shown.push(problem);
	},
	closeStartupStatus: async () => {},
	expectStartupViewer() {
		events.push("expect-viewer");
	},
}));
// Module evaluation is cached, so only the first serve() records loading `./main`.
mock.module("./main", () => {
	events.push("main");
	return {};
});

const { serve } = await import("./serve");
afterAll(() => mock.restore());
afterEach(() => {
	resetRuntimeStartupHooksForTests();
	events.length = 0;
	shown.length = 0;
	statusListening = true;
});

function trapExit() {
	const exit = spyOn(process, "exit").mockImplementation((code) => {
		throw new Error(`fixture-exit:${code}`);
	});
	const stderr = spyOn(console, "error").mockImplementation(() => {});
	return () => {
		exit.mockRestore();
		stderr.mockRestore();
	};
}

test("the host opens its window on the status page and loads its database work under it", async () => {
	registerRuntimeStartupHooks({
		onStartupPageListening(url) {
			events.push(`host-open:${url}`);
			return true;
		},
		beforeServerMain() {
			events.push("before-main");
		},
	});
	await serve();
	expect(events).toEqual([
		"status-page",
		"host-open:http://127.0.0.1:7779",
		"runtime-open",
		"expect-viewer",
		"before-main",
		"main",
	]);
});

test("without a status page the host is not told the page listens", async () => {
	statusListening = false;
	registerRuntimeStartupHooks({
		onStartupPageListening() {
			events.push("host-open");
			return true;
		},
	});
	await serve();
	expect(events).toEqual(["status-page"]);
});

test("a throwing window opener does not cost the server its start", async () => {
	const warn = spyOn(console, "warn").mockImplementation(() => {});
	try {
		registerRuntimeStartupHooks({
			onStartupPageListening() {
				throw new Error("no browser");
			},
		});
		await serve();
		expect(events).toEqual(["status-page", "runtime-open"]);
	} finally {
		warn.mockRestore();
	}
});

test("a lost instance lock the host brings forward exits 0", async () => {
	const restore = trapExit();
	let lockedPid = 0;
	try {
		registerRuntimeStartupHooks({
			beforeServerMain() {
				throw new InstanceLockedError(4242, "fixture: lock held");
			},
			onInstanceLocked({ pid }) {
				lockedPid = pid;
				return true;
			},
		});
		await expect(serve()).rejects.toThrow("fixture-exit:0");
		expect(lockedPid).toBe(4242);
		expect(shown).toEqual([]);
	} finally {
		restore();
	}
});

test("a host that cannot bring it forward still reports the conflict, in its brand", async () => {
	const restore = trapExit();
	try {
		registerRuntimeStartupHooks({
			beforeServerMain() {
				throw new InstanceLockedError(4242, "fixture: lock held");
			},
			onInstanceLocked: () => false,
		});
		await expect(serve()).rejects.toThrow("fixture-exit:1");
		expect(shown).toHaveLength(1);
		expect(shown[0]?.message.zh).toContain("另一个 NovelFork");
		expect(shown[0]?.message.en).not.toContain("NarraFork");
	} finally {
		restore();
	}
});

test("a failing host step is a startup problem shown on the page", async () => {
	const restore = trapExit();
	try {
		registerRuntimeStartupHooks({
			beforeServerMain() {
				throw new Error("product storage broke");
			},
		});
		await expect(serve()).rejects.toThrow("fixture-exit:1");
		expect(shown).toHaveLength(1);
		expect(shown[0]?.message.zh).toBe("NovelFork 启动时遇到意外错误。");
	} finally {
		restore();
	}
});
