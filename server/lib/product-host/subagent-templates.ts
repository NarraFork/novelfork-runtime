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

/**
 * Session-scoped (dynamic) template ids come from product-owned scopes such as a
 * book's custom-subagent list, so they do not need a hyphenated product
 * namespace — they only need to equal the name the model asked for exactly.
 * Built-in and reserved names are never offered to the dynamic resolver.
 */
const DYNAMIC_SUBAGENT_TEMPLATE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

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
		const built = buildTemplate(contribution);
		if ("reason" in built) {
			rejected.push({ id, reason: built.reason });
			continue;
		}
		used.add(id);
		templates.push(built.template);
	}
	return { templates, rejected };
}

/** Validate a template's fields and normalize it; shared by static and dynamic contributions. */
function buildTemplate(
	contribution: RuntimeProductSubagentTemplate,
): { template: RuntimeProductSubagentTemplate } | { reason: string } {
	const id = typeof contribution?.id === "string" ? contribution.id : "";
	if (
		!nonEmpty(contribution.nameZh) ||
		!nonEmpty(contribution.nameEn) ||
		!nonEmpty(contribution.description) ||
		!nonEmpty(contribution.prompt)
	) {
		return { reason: "names, description and prompt are required" };
	}
	const tools = [
		...new Set(
			(Array.isArray(contribution.tools) ? contribution.tools : []).filter(nonEmpty).map((tool) => tool.trim()),
		),
	];
	if (tools.length === 0) {
		return { reason: "template has no tools" };
	}
	return {
		template: Object.freeze({
			id,
			nameZh: contribution.nameZh.trim(),
			nameEn: contribution.nameEn.trim(),
			description: contribution.description.trim(),
			tools: Object.freeze(tools),
			...(nonEmpty(contribution.defaultModel) ? { defaultModel: contribution.defaultModel.trim() } : {}),
			prompt: contribution.prompt.trim(),
		}),
	};
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

/**
 * Ask the product's session-scoped resolver for a template named `name` as seen
 * from `parentNarratorId` — e.g. a subagent custom-defined inside the book that
 * parent is bound to. Never cached: the product may edit its store at any time.
 * Reserved (built-in) names and static template ids are never offered; those are
 * resolved by earlier stages. The returned template must carry the requested
 * name verbatim — a product is free to answer a different template, but the
 * delegation identity stays exactly the `subagent_type` the model typed.
 */
export async function resolveDynamicProductSubagentTemplate(
	parentNarratorId: string | undefined,
	name: string,
	reservedIds: ReadonlySet<string>,
): Promise<RuntimeProductSubagentTemplate | null> {
	if (!parentNarratorId) return null;
	const key = name.trim().toLowerCase();
	if (!DYNAMIC_SUBAGENT_TEMPLATE_ID.test(key) || reservedIds.has(key)) return null;
	const integration = getRuntimeProductIntegration();
	const resolver = integration.narrator?.resolveSubagentTemplate;
	if (!resolver) return null;
	let contribution: RuntimeProductSubagentTemplate | null;
	try {
		contribution = await resolver({ parentNarratorId, name: key });
	} catch (error) {
		logger.warn("Product subagent template resolution failed", {
			productId: integration.id,
			name: key,
			parentNarratorId,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
	if (!contribution || contribution.id !== key) {
		if (contribution) {
			logger.warn("Product subagent template id mismatch", {
				productId: integration.id,
				requested: key,
				returned: contribution.id,
				parentNarratorId,
			});
		}
		return null;
	}
	const built = buildTemplate(contribution);
	if ("reason" in built) {
		logger.warn("Product subagent template rejected", {
			productId: integration.id,
			templateId: key,
			reason: built.reason,
			parentNarratorId,
		});
		return null;
	}
	return built.template;
}
