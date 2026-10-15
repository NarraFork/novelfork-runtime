/**
 * Product-contributed tool routines.
 *
 * A product groups its contributed tools into optional tool routines; the
 * Runtime merges them into the built-in registry so its own routine machinery
 * (modes, project overrides, /load, preloading) manages them. These tests pin
 * the validation boundary and the merge.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ToolDefinition } from "../../agent/types";
import {
	getAllBuiltinRoutines,
	getBuiltinRoutine,
	getBuiltinToolNames,
	getBuiltinToolRoutines,
} from "../../builtin-routines";
import type {
	RuntimeProductIntegration,
	RuntimeProductToolRoutineContribution,
} from "../contracts";
import {
	registerRuntimeProductIntegration,
	resetRuntimeProductIntegrationForTests,
} from "../registry";
import { buildProductToolRoutines } from "../tool-routines";

function fakeTool(name: string): ToolDefinition {
	return { name, description: name } as unknown as ToolDefinition;
}

function integrationWith(
	routines: readonly RuntimeProductToolRoutineContribution[],
	toolNames: readonly string[] = ["vendor_read", "vendor_write", "vendor_purge"],
): RuntimeProductIntegration {
	return {
		id: "vendor",
		narrator: {
			resolve: async () => null,
			resolveContribution: async () => null,
			resolveToolNames: async () => [],
			resolveTrustedPromptRoot: async () => null,
			toolDefinitions: () => toolNames.map(fakeTool),
			isToolAllowed: () => true,
			toolRoutines: () => routines,
		},
	};
}

const writing: RuntimeProductToolRoutineContribution = {
	id: "vendor.writing",
	nameEn: "Writing",
	nameZh: "写作",
	descriptionEn: "Everyday writing tools",
	descriptionZh: "日常写作工具",
	toolNames: ["vendor_read", "vendor_write"],
	defaultMode: "resident",
};

const maintenance: RuntimeProductToolRoutineContribution = {
	id: "vendor.maintenance",
	nameEn: "Maintenance",
	nameZh: "维护",
	descriptionEn: "Bulk cleanup",
	descriptionZh: "批量清理",
	toolNames: ["vendor_purge"],
};

describe("buildProductToolRoutines", () => {
	const reserved = new Set(["terminal", "browser"]);

	test("projects contributions onto tool routines with the declared default mode", () => {
		const { routines, rejected } = buildProductToolRoutines(
			integrationWith([writing, maintenance]),
			reserved,
		);
		expect(rejected).toEqual([]);
		expect(routines.map((r) => r.id)).toEqual(["vendor.writing", "vendor.maintenance"]);
		const [first, second] = routines;
		expect(first?.type).toBe("tool");
		expect(first?.category).toBe("vendor");
		expect(first?.providerId).toBe("vendor");
		expect(first?.defaultMode).toBe("resident");
		expect(first?.nameZh).toBe("写作");
		expect(first?.tool && getBuiltinToolNames(first.tool)).toEqual(["vendor_read", "vendor_write"]);
		// No declared default → manual, like every opt-in built-in.
		expect(second?.defaultMode).toBe("manual");
	});

	test("rejects ids that are not namespaced or collide with a built-in", () => {
		const { routines, rejected } = buildProductToolRoutines(
			integrationWith([
				{ ...writing, id: "writing" },
				{ ...writing, id: "Vendor.Writing" },
				{ ...writing, id: "terminal" },
			]),
			reserved,
		);
		expect(routines).toEqual([]);
		expect(rejected.map((r) => r.id)).toEqual(["writing", "Vendor.Writing", "terminal"]);
	});

	test("a routine can never claim a tool the product did not register", () => {
		const { routines, rejected } = buildProductToolRoutines(
			integrationWith([{ ...writing, toolNames: ["Terminal", "vendor_read"] }]),
			reserved,
		);
		expect(routines[0]?.tool && getBuiltinToolNames(routines[0].tool)).toEqual(["vendor_read"]);
		expect(rejected[0]?.reason).toContain("Terminal");

		const onlyBuiltins = buildProductToolRoutines(
			integrationWith([{ ...writing, toolNames: ["Terminal", "Browser"] }]),
			reserved,
		);
		expect(onlyBuiltins.routines).toEqual([]);
	});

	test("each contributed tool belongs to the first routine listing it", () => {
		const { routines } = buildProductToolRoutines(
			integrationWith([writing, { ...maintenance, toolNames: ["vendor_write", "vendor_purge"] }]),
			reserved,
		);
		expect(routines[1]?.tool && getBuiltinToolNames(routines[1].tool)).toEqual(["vendor_purge"]);
	});

	test("missing localized names are rejected rather than shown blank", () => {
		const { routines, rejected } = buildProductToolRoutines(
			integrationWith([{ ...writing, nameZh: "  " }]),
			reserved,
		);
		expect(routines).toEqual([]);
		expect(rejected).toHaveLength(1);
	});
});

describe("built-in registry merge", () => {
	beforeEach(resetRuntimeProductIntegrationForTests);
	afterEach(resetRuntimeProductIntegrationForTests);

	test("standalone Runtime has only built-in routines", () => {
		expect(getAllBuiltinRoutines().some((r) => r.providerId)).toBe(false);
	});

	test("a registered product's routines join the tool routine lookups", () => {
		registerRuntimeProductIntegration(integrationWith([writing, maintenance]));
		const toolRoutineIds = getBuiltinToolRoutines().map((r) => r.id);
		expect(toolRoutineIds).toContain("terminal");
		expect(toolRoutineIds).toContain("vendor.writing");
		expect(toolRoutineIds).toContain("vendor.maintenance");
		expect(getBuiltinRoutine("vendor.maintenance")?.providerId).toBe("vendor");
		// Built-ins keep precedence and order; product routines follow them.
		expect(toolRoutineIds.indexOf("terminal")).toBeLessThan(
			toolRoutineIds.indexOf("vendor.writing"),
		);
	});
});
