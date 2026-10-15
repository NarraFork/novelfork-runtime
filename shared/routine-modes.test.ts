/**
 * Tool routine mode tests.
 *
 * The three-position switch replaced a boolean, so the derivation has to keep
 * reading old configs correctly (a `enabledRoutines` entry written before this
 * existed still means "resident") and keep writing them (a downgrade, or the
 * `NarraForkAdmin` tool editing `enabledRoutines` directly, must not disagree
 * with `toolModes`). Those two directions are what these tests pin down.
 */
import { describe, expect, test } from "bun:test";
import {
	applyToolRoutineMode,
	clearToolRoutineMode,
	isPreloadedMode,
	normalizeToolRoutineMode,
	normalizeToolRoutineModeOverride,
	resolveEffectiveToolRoutineMode,
	resolveProjectToolRoutineModeOverride,
	resolveToolRoutineMode,
} from "./routine-modes";

const optIn = { id: "browser" };
const defaultOn = { id: "terminal", defaultEnabled: true };

describe("normalizeToolRoutineMode", () => {
	test("accepts the three positions and rejects everything else", () => {
		expect(normalizeToolRoutineMode("manual")).toBe("manual");
		expect(normalizeToolRoutineMode("auto")).toBe("auto");
		expect(normalizeToolRoutineMode("resident")).toBe("resident");
		expect(normalizeToolRoutineMode("global")).toBeNull();
		expect(normalizeToolRoutineMode("enabled")).toBeNull();
		expect(normalizeToolRoutineMode(true)).toBeNull();
		expect(normalizeToolRoutineMode(undefined)).toBeNull();
	});

	test("the override variant additionally accepts 'global'", () => {
		expect(normalizeToolRoutineModeOverride("global")).toBe("global");
		expect(normalizeToolRoutineModeOverride("auto")).toBe("auto");
		expect(normalizeToolRoutineModeOverride("nonsense")).toBeNull();
	});
});

describe("resolveToolRoutineMode — legacy compatibility", () => {
	test("an unconfigured opt-in routine is manual", () => {
		expect(resolveToolRoutineMode(optIn, {})).toBe("manual");
		expect(resolveToolRoutineMode(optIn, undefined)).toBe("manual");
	});

	test("a legacy enabledRoutines entry reads as resident", () => {
		expect(resolveToolRoutineMode(optIn, { enabledRoutines: ["browser"] })).toBe("resident");
	});

	test("a defaultEnabled routine is resident until blacklisted", () => {
		expect(resolveToolRoutineMode(defaultOn, {})).toBe("resident");
		expect(resolveToolRoutineMode(defaultOn, { disabledRoutines: ["terminal"] })).toBe("manual");
	});

	test("an explicit toolModes entry wins over the legacy lists", () => {
		// This combination is what a stale legacy writer leaves behind; the new
		// field must be the authority or the UI would show a position the session
		// build does not honour.
		const mode = resolveToolRoutineMode(optIn, {
			enabledRoutines: ["browser"],
			toolModes: { browser: "auto" },
		});
		expect(mode).toBe("auto");
	});

	test("an unrecognized toolModes value falls through to the legacy lists", () => {
		expect(
			resolveToolRoutineMode(optIn, {
				enabledRoutines: ["browser"],
				toolModes: { browser: "bogus" },
			}),
		).toBe("resident");
	});
});

describe("project layer", () => {
	test("no project entry means follow global", () => {
		expect(resolveProjectToolRoutineModeOverride(optIn, undefined)).toBe("global");
		expect(resolveProjectToolRoutineModeOverride(optIn, {})).toBe("global");
	});

	test("defaultEnabled is not read as a project opinion", () => {
		// Otherwise every default-on routine would look permanently pinned at the
		// project level and "follow global" would be unreachable in the UI.
		expect(resolveProjectToolRoutineModeOverride(defaultOn, {})).toBe("global");
	});

	test("a project mode overrides the global mode", () => {
		const result = resolveEffectiveToolRoutineMode(
			optIn,
			{ toolModes: { browser: "resident" } },
			{ toolModes: { browser: "manual" } },
		);
		expect(result).toEqual({ mode: "manual", source: "project" });
	});

	test("a project override can turn a globally manual tool resident", () => {
		const result = resolveEffectiveToolRoutineMode(
			optIn,
			{},
			{ toolModes: { browser: "resident" } },
		);
		expect(result).toEqual({ mode: "resident", source: "project" });
	});

	test("legacy project lists still act as overrides", () => {
		expect(resolveEffectiveToolRoutineMode(optIn, {}, { enabledRoutines: ["browser"] })).toEqual({
			mode: "resident",
			source: "project",
		});
		expect(
			resolveEffectiveToolRoutineMode(
				optIn,
				{ enabledRoutines: ["browser"] },
				{ disabledRoutines: ["browser"] },
			),
		).toEqual({ mode: "manual", source: "project" });
	});

	test("an empty project layer defers to global", () => {
		expect(resolveEffectiveToolRoutineMode(optIn, { toolModes: { browser: "auto" } }, {})).toEqual({
			mode: "auto",
			source: "global",
		});
	});
});

describe("isPreloadedMode", () => {
	test("only resident preloads; auto is not implemented yet", () => {
		expect(isPreloadedMode("resident")).toBe(true);
		expect(isPreloadedMode("manual")).toBe(false);
		// Toolsearch does not exist, so `auto` must not silently behave like
		// `resident` and put every optional tool in the model's tool table.
		expect(isPreloadedMode("auto")).toBe(false);
	});
});

describe("applyToolRoutineMode", () => {
	test("resident writes the mode and the legacy whitelist together", () => {
		const next = applyToolRoutineMode({}, "browser", "resident");
		expect(next.toolModes).toEqual({ browser: "resident" });
		expect(next.enabledRoutines).toEqual(["browser"]);
		expect(next.disabledRoutines).toEqual([]);
	});

	test("manual writes the mode and the legacy blacklist together", () => {
		const next = applyToolRoutineMode({ enabledRoutines: ["browser"] }, "browser", "manual");
		expect(next.toolModes).toEqual({ browser: "manual" });
		expect(next.enabledRoutines).toEqual([]);
		expect(next.disabledRoutines).toEqual(["browser"]);
	});

	test("auto lands in neither legacy list, so an old reader sees 'not enabled'", () => {
		const next = applyToolRoutineMode({ enabledRoutines: ["browser"] }, "browser", "auto");
		expect(next.toolModes).toEqual({ browser: "auto" });
		expect(next.enabledRoutines).toEqual([]);
		expect(next.disabledRoutines).toEqual([]);
	});

	test("the written config resolves back to the mode that was set", () => {
		for (const mode of ["manual", "auto", "resident"] as const) {
			const next = applyToolRoutineMode({}, "browser", mode);
			expect(resolveToolRoutineMode(optIn, next)).toBe(mode);
		}
	});

	test("other routines and unrelated keys are left alone", () => {
		const next = applyToolRoutineMode(
			{
				enabledRoutines: ["recall"],
				disabledRoutines: ["eval"],
				toolModes: { recall: "resident" },
			},
			"browser",
			"resident",
		);
		expect(next.enabledRoutines).toEqual(["recall", "browser"]);
		expect(next.disabledRoutines).toEqual(["eval"]);
		expect(next.toolModes).toEqual({ recall: "resident", browser: "resident" });
	});

	test("does not mutate its input", () => {
		const config = { enabledRoutines: ["browser"], toolModes: { browser: "resident" } };
		applyToolRoutineMode(config, "browser", "manual");
		expect(config).toEqual({ enabledRoutines: ["browser"], toolModes: { browser: "resident" } });
	});
});

describe("clearToolRoutineMode", () => {
	test("removes every trace so the layer above applies", () => {
		const next = clearToolRoutineMode(
			{ enabledRoutines: ["browser", "recall"], toolModes: { browser: "auto" } },
			"browser",
		);
		expect(next.toolModes).toEqual({});
		expect(next.enabledRoutines).toEqual(["recall"]);
		expect(resolveProjectToolRoutineModeOverride(optIn, next)).toBe("global");
	});
});

describe("routine default mode", () => {
	// Product-contributed routines declare their own starting position. It applies
	// only while neither layer has an opinion, exactly like `defaultEnabled` does.
	const residentByDefault = { id: "vendor.writing", defaultMode: "resident" as const };
	const autoByDefault = { id: "vendor.search", defaultMode: "auto" as const };

	test("an unconfigured routine starts at its declared default mode", () => {
		expect(resolveToolRoutineMode(residentByDefault, undefined)).toBe("resident");
		expect(resolveToolRoutineMode(residentByDefault, {})).toBe("resident");
		expect(resolveToolRoutineMode(autoByDefault, {})).toBe("auto");
	});

	test("the global layer still overrides the default mode, legacy lists included", () => {
		expect(
			resolveToolRoutineMode(residentByDefault, { toolModes: { "vendor.writing": "manual" } }),
		).toBe("manual");
		expect(
			resolveToolRoutineMode(residentByDefault, { disabledRoutines: ["vendor.writing"] }),
		).toBe("manual");
		expect(resolveToolRoutineMode(autoByDefault, { enabledRoutines: ["vendor.search"] })).toBe(
			"resident",
		);
	});

	test("effective mode falls back to the default only when both layers are silent", () => {
		expect(resolveEffectiveToolRoutineMode(residentByDefault, {}, {})).toEqual({
			mode: "resident",
			source: "global",
		});
		expect(
			resolveEffectiveToolRoutineMode(
				residentByDefault,
				{},
				{ toolModes: { "vendor.writing": "manual" } },
			),
		).toEqual({ mode: "manual", source: "project" });
		// The default is a property of the routine, never a project opinion.
		expect(resolveProjectToolRoutineModeOverride(residentByDefault, {})).toBe("global");
	});

	test("an invalid declared default falls back to the defaultEnabled projection", () => {
		const bogus = { id: "vendor.bogus", defaultMode: "always" as unknown as "manual" };
		expect(resolveToolRoutineMode(bogus, {})).toBe("manual");
	});
});
