/**
 * Product-host narrator seam shared by session setup and the turn orchestrator.
 *
 * A registered product integration may contribute tools, a trusted working
 * directory, and a per-mode tool policy for its own narrators. Without an
 * integration every helper falls back to the stock Runtime behaviour.
 */
import { getRuntimeProductIntegration } from "../lib/product-host";
import { resolveNarratorSessionCwd } from "./narrator-cwd";

// Resolved at import time on purpose: this locks the registry, so a product
// cannot be swapped after the session graph has observed it.
export const runtimeProductIntegration = getRuntimeProductIntegration();

export function hasProductNarratorProfile(traits: unknown): boolean {
	return runtimeProductIntegration.isProductNarrator?.(traits) ?? false;
}

export function resolveProductNarratorCwd(
	input: Readonly<{
		traits: unknown;
		narratorCwd: string | null | undefined;
		worktreePath: string | null | undefined;
		projectGitPath: string | null | undefined;
		fallbackCwd: string;
	}>,
): string {
	return (
		runtimeProductIntegration.resolveNarratorCwd?.(input) ??
		resolveNarratorSessionCwd(
			input.narratorCwd,
			input.worktreePath,
			input.projectGitPath,
			input.fallbackCwd,
		)
	);
}

export function syncProductRuntimeToolVisibility(
	enabledToolNames: Set<string>,
	resolvedToolNames: readonly string[],
): void {
	runtimeProductIntegration.narrator?.syncToolVisibility(enabledToolNames, resolvedToolNames);
}

/** Re-resolve contributed tools from the trusted host binding (not persisted /load state). */
export async function refreshProductRuntimeToolVisibility(
	narratorId: string,
	enabledToolNames: Set<string>,
): Promise<void> {
	syncProductRuntimeToolVisibility(
		enabledToolNames,
		await (runtimeProductIntegration.narrator?.resolveToolNames(narratorId) ?? []),
	);
}

function isRegisteredProductRuntimeTool(toolName: string): boolean {
	return (
		runtimeProductIntegration.narrator?.toolDefinitions().some((tool) => tool.name === toolName) ??
		false
	);
}

export function canManageProductRuntimeTool(toolName: string, traits: unknown): boolean {
	if (!isRegisteredProductRuntimeTool(toolName)) return true;
	if (!hasProductNarratorProfile(traits)) return false;
	return (
		runtimeProductIntegration.narrator?.getToolPermissionPolicy?.(toolName)?.visibility ===
		"advanced"
	);
}

export function isProductRuntimeToolAllowed(
	toolName: string,
	enabledOptionalToolNames: ReadonlySet<string>,
): boolean {
	return (
		runtimeProductIntegration.narrator?.isToolAllowed(toolName, enabledOptionalToolNames) ?? false
	);
}

export function isProductRuntimeToolModeAllowed(
	toolName: string,
	permissionMode: string | null | undefined,
	planMode: boolean,
): boolean {
	const policy = runtimeProductIntegration.narrator?.getToolPermissionPolicy?.(toolName);
	if (!policy) return true;
	const mode = planMode
		? "plan"
		: permissionMode === "bypassPermissions"
			? "allow"
			: permissionMode === "acceptEdits"
				? "edit"
				: permissionMode === "readOnly"
					? "read"
					: "ask";
	return policy.enabledForModes.includes(mode);
}

/** Both gates a product narrator applies on top of the Runtime tool filter. */
export function isProductRuntimeToolVisible(
	toolName: string,
	enabledOptionalToolNames: ReadonlySet<string>,
	permissionMode: string | null | undefined,
	planMode: boolean,
): boolean {
	return (
		isProductRuntimeToolAllowed(toolName, enabledOptionalToolNames) &&
		isProductRuntimeToolModeAllowed(toolName, permissionMode, planMode)
	);
}
