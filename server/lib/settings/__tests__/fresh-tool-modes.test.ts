import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getBuiltinToolRoutines, getRuntimeOwnToolRoutines } from "../../builtin-routines";
import type { RuntimeProductIntegration } from "../../product-host/contracts";
import {
	registerRuntimeProductIntegration,
	resetRuntimeProductIntegrationForTests,
} from "../../product-host/registry";
import { narraforkDir, reloadSettings } from "../index";

const path = join(narraforkDir, "settings.json");
const backup = join(narraforkDir, `settings.fresh-tool-modes-${process.pid}.backup`);
let original: string | undefined;

afterEach(() => {
	if (original !== undefined) writeFileSync(path, original);
	else if (existsSync(backup)) rmSync(backup);
	reloadSettings();
});

describe("fresh optional-tool defaults", () => {
	test("opts every built-in tool group into auto only on a fresh install", () => {
		original = readFileSync(path, "utf8");
		renameSync(path, backup);
		const fresh = reloadSettings();
		const ids = getBuiltinToolRoutines().map((routine) => routine.id);
		expect(Object.keys(fresh.routines.toolModes ?? {}).sort()).toEqual(ids.sort());
		expect(Object.values(fresh.routines.toolModes ?? {})).toEqual(ids.map(() => "auto"));
		writeFileSync(path, original);
	});

	test("a fresh install does not lock the product registry before a product registers", () => {
		// Fork layer: settings load while the product entry is still importing Runtime
		// modules. Writing fresh defaults must not read product routines, or the later
		// registerRuntimeProductIntegration() call is rejected and the product cannot start.
		original = readFileSync(path, "utf8");
		renameSync(path, backup);
		resetRuntimeProductIntegrationForTests();
		try {
			const fresh = reloadSettings();
			const ownIds = getRuntimeOwnToolRoutines().map((routine) => routine.id);
			expect(Object.keys(fresh.routines.toolModes ?? {}).sort()).toEqual(ownIds.sort());
			expect(() =>
				registerRuntimeProductIntegration({ id: "fresh-settings-probe" } as RuntimeProductIntegration),
			).not.toThrow();
		} finally {
			resetRuntimeProductIntegrationForTests();
			writeFileSync(path, original);
		}
	});

	test("does not merge fresh defaults into an existing configuration", () => {
		original = readFileSync(path, "utf8");
		const existing = JSON.parse(original);
		existing.routines = {
			disabledRoutines: ["recall"],
			enabledRoutines: ["terminal"],
			toolModes: { recall: "manual", terminal: "resident" },
		};
		writeFileSync(path, JSON.stringify(existing));
		const loaded = reloadSettings();
		expect(loaded.routines.toolModes).toEqual({ recall: "manual", terminal: "resident" });
		expect(loaded.routines.enabledRoutines).toEqual(["terminal"]);
		expect(loaded.routines.disabledRoutines).toEqual(["recall"]);
	});
});
