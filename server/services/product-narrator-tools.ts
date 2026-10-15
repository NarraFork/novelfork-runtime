/**
 * Product-host narrator seam shared by session setup and the turn orchestrator.
 *
 * A registered product integration may contribute tools, a trusted working
 * directory, and a per-mode tool policy for its own narrators. Without an
 * integration every helper falls back to the stock Runtime behaviour.
 *
 * Enabling and visibility are kept apart:
 *   - a contributed tool is *enabled* for a session exactly like a built-in
 *     optional tool — by its tool routine's mode, `/load`, or a persisted load —
 *     and lives in `_enabledOptionalTools`. Nothing in this module writes there.
 *   - it is *visible* on a turn only if the product also exposes it to this
 *     narrator right now (`_productRuntimeToolNames`: trusted binding plus any
 *     product step gate) and its permission policy allows the session mode.
 */
import { getRuntimeProductIntegration } from "../lib/product-host";
import { resolveNarratorSessionCwd } from "./narrator-cwd";

// Resolved at import time on purpose: this locks the registry, so a product
// cannot be swapped after the session graph has observed it.
export const runtimeProductIntegration = getRuntimeProductIntegration();

/** The two per-session sets the product visibility check reads. */
export interface ProductToolSessionView {
	readonly _enabledOptionalTools: ReadonlySet<string>;
	/** Contributed tools the product exposed to this narrator on the latest resolution. */
	readonly _productRuntimeToolNames?: ReadonlySet<string>;
}

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

let registeredProductToolNames: ReadonlySet<string> | null = null;

/** Whether the tool was contributed by the product (as opposed to a built-in or MCP tool). */
export function isRegisteredProductRuntimeTool(toolName: string): boolean {
	registeredProductToolNames ??= new Set(
		runtimeProductIntegration.narrator?.toolDefinitions().map((tool) => tool.name) ?? [],
	);
	return registeredProductToolNames.has(toolName);
}

/**
 * The contributed tools the product exposes to this narrator now, re-resolved
 * from the trusted host binding (never from persisted `/load` state). It is a
 * visibility set: membership never enables a tool.
 */
export async function resolveProductRuntimeToolNames(
	narratorId: string,
): Promise<ReadonlySet<string>> {
	return new Set(await (runtimeProductIntegration.narrator?.resolveToolNames(narratorId) ?? []));
}

/**
 * Whether a session may load/unload a tool. Built-in tools always may; a
 * contributed tool only for a narrator the product resolves a trusted binding
 * for — any other narrator would never see it, so "loaded" would be a lie.
 */
export async function canManageProductRuntimeTool(
	toolName: string,
	narratorId: string,
): Promise<boolean> {
	if (!isRegisteredProductRuntimeTool(toolName)) return true;
	const narrator = runtimeProductIntegration.narrator;
	if (!narrator) return false;
	try {
		return (await narrator.resolve(narratorId)) !== null;
	} catch {
		return false;
	}
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

/**
 * The product's visibility gates for a contributed tool on this turn. Tools the
 * product did not contribute pass untouched; the optional-tool (enabled) gate is
 * applied separately by the caller, as for every other optional tool.
 */
export function isProductRuntimeToolVisible(
	toolName: string,
	session: ProductToolSessionView,
	permissionMode: string | null | undefined,
	planMode: boolean,
): boolean {
	if (!isRegisteredProductRuntimeTool(toolName)) return true;
	if (!session._productRuntimeToolNames?.has(toolName)) return false;
	return (
		isProductRuntimeToolAllowed(toolName, session._enabledOptionalTools) &&
		isProductRuntimeToolModeAllowed(toolName, permissionMode, planMode)
	);
}
