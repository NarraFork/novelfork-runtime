/**
 * Product-contributed delegation templates (built-in subagents).
 *
 * A product integration may contribute read-only subagent templates. They are
 * projected onto the custom-subagent definition shape (`toolAccess: "custom"`)
 * so the existing delegation machinery compiles them into an ordinary capability
 * ceiling; nothing else in the Runtime needs to know they came from a product.
 */

import { logger } from "../logger";
import type { RuntimeProductIntegration, RuntimeProductSubagentTemplate } from "./contracts";
import { getRuntimeProductIntegration } from "./registry";

/**
 * `<product>-<role>`: lowercase, at least one hyphen. The namespace keeps product
 * templates apart from built-in templates and from most user-chosen names.
 */
const PRODUCT_SUBAGENT_TEMPLATE_ID = /^[a-z0-9]+-[a-z0-9][a-z0-9-]*$/;

export interface ProductSubagentTemplateRejection {
	readonly id: string;
	readonly reason: string;
}

export interface ProductSubagentTemplateBuild {
	readonly templates: readonly RuntimeProductSubagentTemplate[];
	readonly rejected: readonly ProductSubagentTemplateRejection[];
}

function nonEmpty(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validate one product's template contributions.
 *
 * - ids must be namespaced lowercase and must not collide with a reserved
 *   (built-in) template name or an earlier template;
 * - names, description and prompt are required;
 * - tools are de-duplicated string names; a template with no tools is dropped
 *   (an empty ceiling would be a useless subagent, and is almost always a bug).
 */
export function buildProductSubagentTemplates(
	integration: RuntimeProductIntegration,
	reservedIds: ReadonlySet<string>,
): ProductSubagentTemplateBuild {
	const contributions = integration.subagentTemplates?.() ?? [];
	const used = new Set(reservedIds);
	const templates: RuntimeProductSubagentTemplate[] = [];
	const rejected: ProductSubagentTemplateRejection[] = [];
	for (const contribution of contributions) {
		const id = typeof contribution?.id === "string" ? contribution.id : "";
		if (!PRODUCT_SUBAGENT_TEMPLATE_ID.test(id)) {
			rejected.push({ id, reason: "id must be lowercase and namespaced, e.g. product-role" });
			continue;
		}
		if (used.has(id)) {
			rejected.push({ id, reason: "id collides with a built-in or earlier template" });
			continue;
		}
		if (
			!nonEmpty(contribution.nameZh) ||
			!nonEmpty(contribution.nameEn) ||
			!nonEmpty(contribution.description) ||
			!nonEmpty(contribution.prompt)
		) {
			rejected.push({ id, reason: "names, description and prompt are required" });
			continue;
		}
		const tools = [
			...new Set(
				(Array.isArray(contribution.tools) ? contribution.tools : []).filter(nonEmpty).map((tool) => tool.trim()),
			),
		];
		if (tools.length === 0) {
			rejected.push({ id, reason: "template has no tools" });
			continue;
		}
		used.add(id);
		templates.push(
			Object.freeze({
				id,
				nameZh: contribution.nameZh.trim(),
				nameEn: contribution.nameEn.trim(),
				description: contribution.description.trim(),
				tools: Object.freeze(tools),
				...(nonEmpty(contribution.defaultModel) ? { defaultModel: contribution.defaultModel.trim() } : {}),
				prompt: contribution.prompt.trim(),
			}),
		);
	}
	return { templates, rejected };
}

let cache: {
	readonly integration: RuntimeProductIntegration;
	readonly templates: readonly RuntimeProductSubagentTemplate[];
} | null = null;

/**
 * Templates of the registered product integration, built once per integration.
 * Contributions are static product metadata, so there is nothing to invalidate
 * within a process. A product whose contribution throws contributes nothing.
 */
export function getProductSubagentTemplates(
	reservedIds: ReadonlySet<string>,
): readonly RuntimeProductSubagentTemplate[] {
	const integration = getRuntimeProductIntegration();
	if (cache?.integration === integration) return cache.templates;
	let build: ProductSubagentTemplateBuild;
	try {
		build = buildProductSubagentTemplates(integration, reservedIds);
	} catch (error) {
		logger.warn("Product subagent templates failed to load", {
			productId: integration.id,
			error: error instanceof Error ? error.message : String(error),
		});
		build = { templates: [], rejected: [] };
	}
	for (const rejection of build.rejected) {
		logger.warn("Product subagent template rejected", {
			productId: integration.id,
			templateId: rejection.id,
			reason: rejection.reason,
		});
	}
	cache = { integration, templates: build.templates };
	return build.templates;
}

/** Test-only: forget the per-integration cache. */
export function resetProductSubagentTemplatesForTests(): void {
	cache = null;
}
