/**
 * Product-contributed tool routines.
 *
 * A product integration may group the tools it contributes into optional tool
 * routines. They are projected onto the built-in routine shape here and merged
 * into the built-in registry (`builtin-routines`), so the Runtime's own routine
 * machinery — global and project modes, `/load`, session preloading, the
 * "可选工具" page — manages them. The product never edits a session's enabled
 * tool set; this module is the only place its routines enter the Runtime.
 */

import { normalizeToolRoutineMode } from "@shared/routine-modes";
import type { BuiltinRoutine } from "../builtin-routines";
import { logger } from "../logger";
import type { RuntimeProductIntegration, RuntimeProductToolRoutineContribution } from "./contracts";
import { getRuntimeProductIntegration } from "./registry";

/**
 * `<product>.<group>`: lowercase, at least one dot. The namespace keeps product
 * ids apart from built-in ids, and lowercase is what `/load` matches against.
 */
const PRODUCT_TOOL_ROUTINE_ID = /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/;

export interface ProductToolRoutineRejection {
	readonly id: string;
	readonly reason: string;
}

export interface ProductToolRoutineBuild {
	readonly routines: readonly BuiltinRoutine[];
	readonly rejected: readonly ProductToolRoutineRejection[];
}

function nonEmpty(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validate one product's routine contributions and project them onto the
 * built-in routine shape.
 *
 * - ids must be namespaced and must not collide with a built-in or earlier routine;
 * - only tools the product itself registered are kept, so a routine can never
 *   take over a built-in optional tool (e.g. make `Terminal` resident for everyone);
 * - each contributed tool belongs to the first routine that lists it;
 * - a routine left with no tools is dropped.
 */
export function buildProductToolRoutines(
	integration: RuntimeProductIntegration,
	reservedIds: ReadonlySet<string>,
): ProductToolRoutineBuild {
	const narrator = integration.narrator;
	const contributions: readonly RuntimeProductToolRoutineContribution[] =
		narrator?.toolRoutines?.() ?? [];
	if (!narrator || contributions.length === 0) return { routines: [], rejected: [] };

	const registered = new Set(narrator.toolDefinitions().map((tool) => tool.name));
	const usedIds = new Set(reservedIds);
	const claimedTools = new Set<string>();
	const routines: BuiltinRoutine[] = [];
	const rejected: ProductToolRoutineRejection[] = [];

	for (const contribution of contributions) {
		const id = typeof contribution.id === "string" ? contribution.id : "";
		if (!PRODUCT_TOOL_ROUTINE_ID.test(id)) {
			rejected.push({ id, reason: "id must be lowercase and namespaced, e.g. product.group" });
			continue;
		}
		if (usedIds.has(id)) {
			rejected.push({ id, reason: "id collides with an existing routine" });
			continue;
		}
		if (
			!nonEmpty(contribution.nameEn) ||
			!nonEmpty(contribution.nameZh) ||
			!nonEmpty(contribution.descriptionEn) ||
			!nonEmpty(contribution.descriptionZh)
		) {
			rejected.push({ id, reason: "names and descriptions are required in both languages" });
			continue;
		}

		const toolNames: string[] = [];
		const ignored: string[] = [];
		for (const toolName of contribution.toolNames ?? []) {
			if (!registered.has(toolName) || claimedTools.has(toolName)) {
				ignored.push(toolName);
				continue;
			}
			claimedTools.add(toolName);
			toolNames.push(toolName);
		}
		if (ignored.length > 0) {
			rejected.push({
				id,
				reason: `ignored tools not registered by the product or already in another routine: ${ignored.join(", ")}`,
			});
		}
		const [primary] = toolNames;
		if (!primary) {
			rejected.push({ id, reason: "routine has no product tools" });
			continue;
		}

		const defaultMode = normalizeToolRoutineMode(contribution.defaultMode) ?? "manual";
		usedIds.add(id);
		routines.push({
			id,
			type: "tool",
			category: integration.id,
			defaultMode,
			nameEn: contribution.nameEn,
			nameZh: contribution.nameZh,
			providerId: integration.id,
			tool: {
				toolName: primary,
				toolNames,
				descriptionEn: contribution.descriptionEn,
				descriptionZh: contribution.descriptionZh,
			},
		});
	}

	return { routines, rejected };
}

let cache: {
	readonly integration: RuntimeProductIntegration;
	readonly routines: readonly BuiltinRoutine[];
} | null = null;

/**
 * Tool routines of the registered product integration, built once per
 * integration. Contributions are static product metadata, so there is nothing
 * to invalidate within a process.
 */
export function getProductToolRoutines(
	reservedIds: ReadonlySet<string>,
): readonly BuiltinRoutine[] {
	const integration = getRuntimeProductIntegration();
	if (cache?.integration === integration) return cache.routines;
	const { routines, rejected } = buildProductToolRoutines(integration, reservedIds);
	for (const rejection of rejected) {
		logger.warn("Product tool routine contribution adjusted", {
			productId: integration.id,
			routineId: rejection.id,
			reason: rejection.reason,
		});
	}
	cache = { integration, routines };
	return routines;
}
