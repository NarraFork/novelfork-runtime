/**
 * A new primary narrator's optional-tool set must not include the default-off tools.
 * This is the end-to-end form of "novelist's default toolset excludes Bash, Write,
 * Terminal and Browser": it runs the same collector the session build uses.
 */
import { describe, expect, test } from "bun:test";
import { collectSessionOptionalTools } from "../narrator-session";

const DEFAULT_OFF_TOOLS = ["Bash", "Write", "Terminal", "Browser"];

describe("default session optional tools", () => {
	test("a fresh session preloads none of the default-off tools", () => {
		const loaded = collectSessionOptionalTools(undefined, []);
		for (const toolName of DEFAULT_OFF_TOOLS) expect(loaded.has(toolName)).toBe(false);
	});

	test("a persisted load of a default-off tool is honoured once the author asks for it", () => {
		const loaded = collectSessionOptionalTools(undefined, ["Write"]);
		expect(loaded.has("Write")).toBe(true);
		expect(loaded.has("Bash")).toBe(false);
	});

	test("a project resident override loads the routine's tools", () => {
		const loaded = collectSessionOptionalTools({ toolModes: { bash: "resident" } }, []);
		expect(loaded.has("Bash")).toBe(true);
		expect(loaded.has("Write")).toBe(false);
	});
});
