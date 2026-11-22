import { afterEach, describe, expect, spyOn, test } from "bun:test";
import {
	getRuntimeStartupHooks,
	notifyStartupHook,
	registerRuntimeStartupHooks,
	resetRuntimeStartupHooksForTests,
} from "../startup-hooks";

afterEach(() => resetRuntimeStartupHooksForTests());

describe("runtime startup hooks", () => {
	test("a standalone Runtime has no hooks", () => {
		expect(getRuntimeStartupHooks()).toEqual({});
	});

	test("the registry is shared through globalThis", async () => {
		const hooks = { onServerListening() {} };
		registerRuntimeStartupHooks(hooks);
		expect(getRuntimeStartupHooks()).toBe(hooks);
		const key = Symbol.for("narrafork.runtimeStartupHooks.v1");
		expect((globalThis as Record<symbol, unknown>)[key]).toBe(hooks);
	});

	test("notify passes the result through and swallows a throwing hook", () => {
		expect(notifyStartupHook((url: string) => url === "u", "u")).toBe(true);
		expect(notifyStartupHook(undefined)).toBeUndefined();
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		try {
			expect(
				notifyStartupHook(() => {
					throw new Error("boom");
				}),
			).toBeUndefined();
			expect(warn).toHaveBeenCalled();
		} finally {
			warn.mockRestore();
		}
	});
});
