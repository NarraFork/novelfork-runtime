/**
 * Product tool routines inside narrator sessions.
 *
 * A registered product contributes tools and groups them into tool routines.
 * The Runtime alone decides which of them a session has *enabled* (routine
 * mode, `/load`, persisted loads); the product only narrows what is *visible*
 * on a turn (trusted binding, step gate, permission policy). These tests pin
 * both halves and the honest `/load` failure for narrators the product does not
 * serve.
 *
 * The product integration is read when the session graph is imported, so it is
 * registered first and every Runtime module is imported dynamically afterwards.
 * Runs against a real isolated DB under a temp NARRAFORK_HOME.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { z } from "zod/v4";
import type { ToolDefinition } from "../../lib/agent/types";
import type {
	ContributedToolPermissionPolicy,
	RuntimeProductIntegration,
	RuntimeResolveContext,
} from "../../lib/product-host/contracts";
import {
	registerRuntimeProductIntegration,
	resetRuntimeProductIntegrationForTests,
} from "../../lib/product-host/registry";

const boundNarrators = new Set<string>();
/** Per-narrator product exposure, i.e. what `resolveToolNames` returns this turn. */
const exposure = new Map<string, readonly string[]>();
const vetoed = new Set<string>();

const POLICIES: Record<string, ContributedToolPermissionPolicy> = {
	vendor_read: {
		risk: "read",
		enabledForModes: ["ask", "edit", "allow", "read", "plan"],
		visibility: "author",
	},
	vendor_write: {
		risk: "draft-write",
		enabledForModes: ["ask", "edit", "allow"],
		visibility: "author",
	},
	vendor_purge: {
		risk: "destructive",
		enabledForModes: ["ask", "edit", "allow"],
		visibility: "advanced",
	},
};

function vendorTool(name: string): ToolDefinition {
	return {
		name,
		description: `vendor tool ${name}`,
		parameters: z.object({}),
		execute: async () => ({ output: "ok" }),
	};
}

const context: RuntimeResolveContext = {
	runtimeProjectId: "p",
	projectRoot: "/tmp/p",
	projectType: "vendor",
	enabledPluginIds: [],
	resourceBindings: {},
};

const integration: RuntimeProductIntegration = {
	id: "vendor",
	narrator: {
		resolve: async (narratorId) => (boundNarrators.has(narratorId) ? context : null),
		resolveContribution: async () => null,
		resolveToolNames: async (narratorId) => exposure.get(narratorId) ?? [],
		resolveTrustedPromptRoot: async () => null,
		toolDefinitions: () => Object.keys(POLICIES).map(vendorTool),
		isToolAllowed: (toolName) => !vetoed.has(toolName),
		getToolPermissionPolicy: (toolName) => POLICIES[toolName] ?? null,
		toolRoutines: () => [
			{
				id: "vendor.writing",
				nameEn: "Writing",
				nameZh: "写作",
				descriptionEn: "Everyday writing tools",
				descriptionZh: "日常写作工具",
				toolNames: ["vendor_read", "vendor_write"],
				defaultMode: "resident",
			},
			{
				id: "vendor.maintenance",
				nameEn: "Maintenance",
				nameZh: "维护",
				descriptionEn: "Bulk cleanup",
				descriptionZh: "批量清理",
				toolNames: ["vendor_purge"],
				defaultMode: "manual",
			},
		],
	},
};

resetRuntimeProductIntegrationForTests();
registerRuntimeProductIntegration(integration);

const { db } = await import("../../db");
const { narrators } = await import("../../db/schema");
const { eq } = await import("drizzle-orm");
const { settings } = await import("../../lib/settings");
const { narratorService, handleLoadToolCommand } = await import("../narrator-service");
const session = await import("../narrator-session");
const tools = await import("../product-narrator-tools");
const { resolveCommand } = await import("../command-service");
const routineService = await import("../routine-service");

async function createNarrator(bound: boolean): Promise<string> {
	const narrator = await narratorService.create({ locale: "en" });
	if (bound) boundNarrators.add(narrator.id);
	return narrator.id;
}

const originalRoutines = settings.routines;

beforeAll(() => {
	settings.routines = { disabledRoutines: [], enabledRoutines: [], toolModes: {} };
});

// Narrators created here (and the display messages /load persists for them) stay
// in the per-process temp database the test preload provides.
afterAll(() => {
	settings.routines = originalRoutines;
});

describe("enabled set: routine modes decide, product does not", () => {
	test("a resident product routine is preloaded; a manual one is not", () => {
		const enabled = session.collectSessionOptionalTools(undefined, []);
		expect(enabled.has("vendor_read")).toBe(true);
		expect(enabled.has("vendor_write")).toBe(true);
		expect(enabled.has("vendor_purge")).toBe(false);
	});

	test("global and project modes override the product default", () => {
		settings.routines = {
			disabledRoutines: [],
			enabledRoutines: [],
			toolModes: { "vendor.writing": "manual", "vendor.maintenance": "resident" },
		};
		try {
			const global = session.collectSessionOptionalTools(undefined, []);
			expect(global.has("vendor_write")).toBe(false);
			expect(global.has("vendor_purge")).toBe(true);

			const project = session.collectSessionOptionalTools(
				{ toolModes: { "vendor.writing": "resident", "vendor.maintenance": "auto" } },
				[],
			);
			expect(project.has("vendor_write")).toBe(true);
			// `auto` is not preloaded until toolsearch exists.
			expect(project.has("vendor_purge")).toBe(false);
		} finally {
			settings.routines = { disabledRoutines: [], enabledRoutines: [], toolModes: {} };
		}
	});

	test("persisted /load state is merged in", () => {
		expect(
			session.collectSessionOptionalTools(undefined, ["vendor_purge"]).has("vendor_purge"),
		).toBe(true);
	});

	test("routine statuses expose localized names and the default mode", () => {
		const statuses = routineService.getGlobalRoutineStatuses();
		const writing = statuses.find((s) => s.id === "vendor.writing");
		expect(writing?.mode).toBe("resident");
		expect(writing?.defaultMode).toBe("resident");
		expect(writing?.nameZh).toBe("写作");
		expect(writing?.providerId).toBe("vendor");
		expect(writing?.toolNames).toEqual(["vendor_read", "vendor_write"]);
		expect(statuses.find((s) => s.id === "vendor.maintenance")?.mode).toBe("manual");
	});
});

describe("visibility: the product only narrows", () => {
	const view = (exposed: readonly string[], enabled: readonly string[] = []) => ({
		_enabledOptionalTools: new Set(enabled),
		_productRuntimeToolNames: new Set(exposed),
	});

	test("built-in tools are untouched by the product gate", () => {
		expect(tools.isProductRuntimeToolVisible("Terminal", view([]), "default", false)).toBe(true);
		expect(tools.isProductRuntimeToolVisible("Bash", view([]), "readOnly", false)).toBe(true);
	});

	test("a contributed tool is hidden unless the product exposes it this turn", () => {
		expect(tools.isProductRuntimeToolVisible("vendor_write", view([]), "default", false)).toBe(
			false,
		);
		expect(
			tools.isProductRuntimeToolVisible(
				"vendor_write",
				{ _enabledOptionalTools: new Set(["vendor_write"]) },
				"default",
				false,
			),
		).toBe(false);
		expect(
			tools.isProductRuntimeToolVisible("vendor_write", view(["vendor_write"]), "default", false),
		).toBe(true);
	});

	test("permission policy and product veto still hide an exposed tool", () => {
		expect(
			tools.isProductRuntimeToolVisible("vendor_write", view(["vendor_write"]), "readOnly", false),
		).toBe(false);
		expect(
			tools.isProductRuntimeToolVisible("vendor_read", view(["vendor_read"]), "readOnly", false),
		).toBe(true);
		vetoed.add("vendor_read");
		try {
			expect(
				tools.isProductRuntimeToolVisible("vendor_read", view(["vendor_read"]), "default", false),
			).toBe(false);
		} finally {
			vetoed.delete("vendor_read");
		}
	});

	test("the exposure set is re-resolved from the product, never from the enabled set", async () => {
		const narratorId = await createNarrator(true);
		exposure.set(narratorId, ["vendor_read"]);
		const names = await tools.resolveProductRuntimeToolNames(narratorId);
		expect([...names]).toEqual(["vendor_read"]);
	});
});

describe("/load of product routines", () => {
	test("/load resolves a product routine id to all of its tools", async () => {
		const result = await resolveCommand("/load vendor.writing", "unused", "unused");
		expect(result).toMatchObject({
			resolved: true,
			loadToolId: "vendor.writing",
			loadTools: ["vendor_read", "vendor_write"],
		});
	});

	test("a bound narrator can load the manual routine; it shows as loaded this session", async () => {
		const narratorId = await createNarrator(true);
		const result = await handleLoadToolCommand(
			narratorId,
			{
				resolved: true,
				loadTool: "vendor_purge",
				loadTools: ["vendor_purge"],
				loadToolId: "vendor.maintenance",
				rawCommand: "/load vendor.maintenance",
			},
			"en",
		);
		expect(result).toEqual({ toolName: "vendor.maintenance", loaded: true, alreadyLoaded: false });
		const [row] = await db
			.select({ enabledTools: narrators.enabledTools })
			.from(narrators)
			.where(eq(narrators.id, narratorId));
		expect(row?.enabledTools).toEqual(["vendor_purge"]);

		const listing = await session.listSessionOptionalTools(narratorId);
		const byId = new Map(listing.routines.map((r) => [r.id, r]));
		expect(byId.get("vendor.writing")).toMatchObject({ source: "resident", nameZh: "写作" });
		expect(byId.get("vendor.maintenance")).toMatchObject({
			source: "session",
			loadedToolNames: ["vendor_purge"],
		});
	});

	test("an unbound narrator gets an honest failure, not 'loaded'", async () => {
		const narratorId = await createNarrator(false);
		const result = await handleLoadToolCommand(
			narratorId,
			{
				resolved: true,
				loadTool: "vendor_purge",
				loadTools: ["vendor_purge"],
				loadToolId: "vendor.maintenance",
				rawCommand: "/load vendor.maintenance",
			},
			"en",
		);
		expect(result).toEqual({ toolName: "vendor.maintenance", loaded: false, alreadyLoaded: false });
		const [row] = await db
			.select({ enabledTools: narrators.enabledTools })
			.from(narrators)
			.where(eq(narrators.id, narratorId));
		expect(row?.enabledTools ?? []).toEqual([]);
		expect((await session.resolveOptionalToolState(narratorId, "vendor_purge")).state).toBe(
			"unknown_tool",
		);
		// Product routines never appear in the details view of a narrator they do not serve.
		const listing = await session.listSessionOptionalTools(narratorId);
		expect(listing.routines.some((r) => r.id.startsWith("vendor."))).toBe(false);
	});
});
