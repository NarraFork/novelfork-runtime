/**
 * A subagent may use a default-off tool only while its parent has it loaded, so a child
 * never widens the parent's optional set. Other tools are unaffected.
 */
import { describe, expect, test } from "bun:test";
import { DEFAULT_OFF_TOOL_NAMES, subagentMayUseDefaultOffTool } from "../agent/tools/default-off-tools";

const DEFAULT_OFF_TOOLS: string[] = ["Bash", "Write", "Terminal", "Browser"];

describe("subagent inheritance of default-off tools", () => {
	test("the default-off set is exactly Bash, Write, Terminal and Browser", () => {
		expect([...DEFAULT_OFF_TOOL_NAMES].sort()).toEqual(["Bash", "Browser", "Terminal", "Write"]);
	});

	test.each(DEFAULT_OFF_TOOLS)("%s is denied to a subagent whose parent has not loaded it", (toolName) => {
		expect(subagentMayUseDefaultOffTool(toolName, new Set())).toBe(false);
	});

	test.each(DEFAULT_OFF_TOOLS)("%s is allowed to a subagent whose parent has loaded it", (toolName) => {
		expect(subagentMayUseDefaultOffTool(toolName, new Set([toolName]))).toBe(true);
	});

	test("other tools are unaffected by the parent's loaded set", () => {
		expect(subagentMayUseDefaultOffTool("Recall", new Set())).toBe(true);
	});
});
