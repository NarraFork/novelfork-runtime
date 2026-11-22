import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readServerAddress } from "../manager-config";
import {
	getManagerHost,
	managerIdentity,
	registerManagerHost,
	resetManagerHostForTests,
} from "../manager-host";
import { setProductName, t } from "../manager-i18n";

const savedEnv = {
	HOST: process.env.HOST,
	PORT: process.env.PORT,
	HOME: process.env.NARRAFORK_HOME,
};
let home = "";

beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "nf-manager-host-"));
	process.env.NARRAFORK_HOME = home;
	delete process.env.HOST;
	delete process.env.PORT;
});

afterEach(() => {
	resetManagerHostForTests();
	setProductName("NarraFork");
	for (const [key, value] of [
		["HOST", savedEnv.HOST],
		["PORT", savedEnv.PORT],
		["NARRAFORK_HOME", savedEnv.HOME],
	] as const) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	rmSync(home, { recursive: true, force: true });
});

describe("manager host registry", () => {
	test("standalone manager keeps the upstream window title and mutex", () => {
		expect(getManagerHost()).toBeUndefined();
		expect(managerIdentity(undefined)).toEqual({
			windowTitle: "NarraFork Manager",
			mutexName: "Local\\NarraFork.Manager",
		});
	});

	test("an embedding host gets its own title and mutex, shared through globalThis", () => {
		const host = { productName: "NovelFork", instanceKey: "NovelFork" };
		registerManagerHost(host);
		expect(getManagerHost()).toBe(host);
		expect((globalThis as Record<symbol, unknown>)[Symbol.for("narrafork.managerHost.v1")]).toBe(
			host,
		);
		expect(managerIdentity(host)).toEqual({
			windowTitle: "NovelFork Manager",
			mutexName: "Local\\NovelFork.Manager",
		});
		// 互斥体名只留安全字符，空键回落到上游名。
		expect(managerIdentity({ productName: "x", instanceKey: " Nov\\el/Fork " }).mutexName).toBe(
			"Local\\NovelFork.Manager",
		);
		expect(managerIdentity({ productName: "x", instanceKey: "  " }).windowTitle).toBe(
			"NarraFork Manager",
		);
	});
});

describe("product name in manager texts", () => {
	test("replaces NarraFork with the host product name", () => {
		expect(t("tray.exit")).toBe("退出 NarraFork");
		setProductName("NovelFork");
		expect(t("tray.exit")).toBe("退出 NovelFork");
		expect(t("button.start")).toBe("启动 NovelFork 服务器");
		setProductName("  ");
		expect(t("tray.exit")).toBe("退出 NarraFork");
	});
});

describe("listen address with an embedding host", () => {
	test("HOST/PORT override settings only when a host is registered", () => {
		writeFileSync(join(home, "settings.json"), JSON.stringify({ server: { port: 7779 } }));
		process.env.PORT = "4613";
		expect(readServerAddress()).toEqual({ host: "127.0.0.1", port: 7779, tls: false });
		registerManagerHost({ productName: "NovelFork", instanceKey: "NovelFork" });
		// 服务没配主机时用 localhost（settings 默认值），端口跟随服务实际认的 PORT。
		expect(readServerAddress()).toEqual({ host: "localhost", port: 4613, tls: false });
		process.env.HOST = "::1";
		expect(readServerAddress().host).toBe("::1");
	});

	test("a configured host is kept and an invalid PORT is ignored", () => {
		writeFileSync(
			join(home, "settings.json"),
			JSON.stringify({ server: { host: "192.168.1.5", port: 8000 } }),
		);
		registerManagerHost({ productName: "NovelFork", instanceKey: "NovelFork" });
		process.env.PORT = "not-a-port";
		expect(readServerAddress()).toEqual({ host: "192.168.1.5", port: 8000, tls: false });
	});
});
