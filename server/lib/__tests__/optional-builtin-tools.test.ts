/**
 * Bash and Write are optional tool routines, like Terminal and Browser: a primary
 * narrator gets them only when the author turns the routine on (globally, per
 * project, or per session with /load). These pin the default-off state.
 */
import { describe, expect, test } from "bun:test";
import { isPreloadedMode, resolveDefaultToolRoutineMode } from "../../../shared/routine-modes";
import { isOptionalTool } from "../agent/tools/index";
import { getBuiltinRoutine, getBuiltinToolNames, getBuiltinToolRoutines } from "../builtin-routines";

const DEFAULT_OFF_TOOLS: string[] = ["Bash", "Write", "Terminal", "Browser"];

describe("default-off built-in tools", () => {
	test.each(DEFAULT_OFF_TOOLS)("%s is an optional tool", (toolName) => {
		expect(isOptionalTool(toolName)).toBe(true);
	});

	test.each(DEFAULT_OFF_TOOLS)("%s is controlled by a tool routine that defaults to manual", (toolName) => {
		const routine = getBuiltinToolRoutines().find(
			(r) => r.tool !== undefined && getBuiltinToolNames(r.tool).includes(toolName),
		);
		const mode = routine ? resolveDefaultToolRoutineMode(routine) : undefined;
		expect(mode).toBe("manual");
	});

	test("the Bash and Write routines are registered under their own ids", () => {
		expect(getBuiltinRoutine("bash")?.tool?.toolName).toBe("Bash");
		expect(getBuiltinRoutine("write")?.tool?.toolName).toBe("Write");
	});

	test("no default-off tool is preloaded into a new session", () => {
		const preloaded = getBuiltinToolRoutines()
			.filter((r) => isPreloadedMode(resolveDefaultToolRoutineMode(r)))
			.flatMap((r) => (r.tool ? getBuiltinToolNames(r.tool) : []));
		for (const toolName of DEFAULT_OFF_TOOLS) expect(preloaded).not.toContain(toolName);
	});
});
