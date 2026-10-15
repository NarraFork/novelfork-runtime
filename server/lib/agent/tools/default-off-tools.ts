/**
 * Built-in tools a primary narrator does not get until the author loads their routine.
 * Kept in a dependency-free leaf so the loop, the executor and the subagent filter can
 * all read the same set without importing the tool registry.
 */
export const DEFAULT_OFF_TOOL_NAMES: ReadonlySet<string> = new Set(["Bash", "Write", "Terminal", "Browser"]);

/**
 * A subagent may use a default-off tool only while its parent has it loaded, so a child
 * can never widen the parent's optional set. Other tools are unaffected.
 */
export function subagentMayUseDefaultOffTool(toolName: string, parentLoaded: ReadonlySet<string>): boolean {
	return !DEFAULT_OFF_TOOL_NAMES.has(toolName) || parentLoaded.has(toolName);
}
