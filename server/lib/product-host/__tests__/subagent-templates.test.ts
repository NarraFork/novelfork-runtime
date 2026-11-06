/**
 * Product-contributed delegation templates (built-in subagents).
 *
 * A product may contribute read-only subagent templates. They resolve like a
 * user's custom definition with `toolAccess: "custom"`, take precedence over a
 * user SUBAGENT.md of the same name, and cannot be created, edited or deleted.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { narraforkDir } from "../../settings";
import { isRuntimeToolAllowed, resolveRuntimePolicy } from "../../../services/agent-runtime/policy";
import {
	compileDelegationCeiling,
	customSubagentService,
} from "../../../services/custom-subagent-service";
import type { RuntimeProductIntegration, RuntimeProductSubagentTemplate } from "../contracts";
import {
	registerRuntimeProductIntegration,
	resetRuntimeProductIntegrationForTests,
} from "../registry";
import {
	buildProductSubagentTemplates,
	resetProductSubagentTemplatesForTests,
} from "../subagent-templates";

const SUBAGENTS_DIR = join(narraforkDir, "subagents");

function template(overrides: Partial<RuntimeProductSubagentTemplate> = {}): RuntimeProductSubagentTemplate {
	return {
		id: "nf-writer",
		nameZh: "执笔",
		nameEn: "Writer",
		description: "Drafts prose",
		tools: ["chapter_read", "workflow_submit_step_output"],
		prompt: "You draft prose.",
		...overrides,
	};
}

function integrationWith(templates: readonly RuntimeProductSubagentTemplate[]): RuntimeProductIntegration {
	return { id: "vendor", subagentTemplates: () => templates };
}

async function writeUserSubagent(dir: string, name: string, prompt: string): Promise<void> {
	await mkdir(join(SUBAGENTS_DIR, dir), { recursive: true });
	await writeFile(
		join(SUBAGENTS_DIR, dir, "SUBAGENT.md"),
		`---\nname: ${name}\ndescription: user\ntoolAccess: general\n---\n\n${prompt}\n`,
		"utf-8",
	);
}

beforeEach(async () => {
	resetRuntimeProductIntegrationForTests();
	resetProductSubagentTemplatesForTests();
	await rm(SUBAGENTS_DIR, { recursive: true, force: true });
});

afterEach(async () => {
	resetRuntimeProductIntegrationForTests();
	resetProductSubagentTemplatesForTests();
	await rm(SUBAGENTS_DIR, { recursive: true, force: true });
});

describe("buildProductSubagentTemplates", () => {
	test("keeps valid templates and rejects bad ids, collisions, missing text and empty tools", () => {
		const reserved = new Set(["general", "explore"]);
		const { templates, rejected } = buildProductSubagentTemplates(
			integrationWith([
				template(),
				template({ id: "nf-writer" }),
				template({ id: "Writer" }),
				template({ id: "general" }),
				template({ id: "nf-empty", tools: [] }),
				template({ id: "nf-noprompt", prompt: "  " }),
				template({ id: "nf-dupe-tools", tools: ["a_read", "a_read", " b_read "] }),
			]),
			reserved,
		);
		expect(templates.map((t) => t.id)).toEqual(["nf-writer", "nf-dupe-tools"]);
		expect(templates[1]?.tools).toEqual(["a_read", "b_read"]);
		expect(rejected.map((r) => r.id)).toEqual(["nf-writer", "Writer", "general", "nf-empty", "nf-noprompt"]);
	});

	test("an integration without the SPI contributes nothing", () => {
		expect(buildProductSubagentTemplates({ id: "vendor" }, new Set())).toEqual({ templates: [], rejected: [] });
	});
});

describe("custom subagent service with product templates", () => {
	test("absent SPI leaves user definitions unchanged", async () => {
		registerRuntimeProductIntegration({ id: "vendor" });
		await writeUserSubagent("my-helper", "my-helper", "user prompt");
		const all = await customSubagentService.loadAll();
		expect(all.map((def) => def.name)).toEqual(["my-helper"]);
		expect(all[0]?.source).toBeUndefined();
		expect((await customSubagentService.loadByName("my-helper"))?.prompt).toBe("user prompt");
		expect(await customSubagentService.loadByName("nf-writer")).toBeNull();
	});

	test("lists product templates first, read-only, and shadows a same-named user file", async () => {
		registerRuntimeProductIntegration(integrationWith([template()]));
		await writeUserSubagent("nf-writer", "nf-writer", "user override attempt");
		await writeUserSubagent("my-helper", "my-helper", "user prompt");
		const all = await customSubagentService.loadAll();
		expect(all.map((def) => def.name)).toEqual(["nf-writer", "my-helper"]);
		expect(all[0]).toMatchObject({
			source: "product",
			readOnly: true,
			toolAccess: "custom",
			customTools: ["chapter_read", "workflow_submit_step_output"],
			prompt: "You draft prose.",
			nameZh: "执笔",
		});
		// loadByName precedence: the product template wins over the user file.
		const loaded = await customSubagentService.loadByName("nf-writer");
		expect(loaded?.source).toBe("product");
		expect(loaded?.prompt).toBe("You draft prose.");
	});

	test("create / update / remove with a product template name is rejected", async () => {
		registerRuntimeProductIntegration(integrationWith([template()]));
		const input = {
			name: "nf-writer",
			description: "x",
			toolAccess: "general" as const,
			customTools: [],
			defaultModel: "",
			prompt: "x",
		};
		await expect(customSubagentService.create(input)).rejects.toThrow(/built-in product subagent/);
		await expect(customSubagentService.create({ ...input, name: "NF-Writer" })).rejects.toThrow(
			/built-in product subagent/,
		);
		await expect(customSubagentService.update("nf-writer", input)).rejects.toThrow(/read-only/);
		await expect(customSubagentService.remove("nf-writer")).rejects.toThrow(/read-only/);

		// Renaming a user definition onto a product name is rejected too.
		await customSubagentService.create({ ...input, name: "my-helper" });
		await expect(customSubagentService.update("my-helper", input)).rejects.toThrow(/built-in product subagent/);
		expect((await customSubagentService.loadByName("my-helper"))?.source).toBeUndefined();
	});

	test("the compiled ceiling of a product template contains exactly its tools", async () => {
		registerRuntimeProductIntegration(integrationWith([template()]));
		const trait = await compileDelegationCeiling("nf-writer");
		expect(trait.tools).toEqual(["chapter_read", "workflow_submit_step_output"]);
		const policy = resolveRuntimePolicy([trait]);
		expect(isRuntimeToolAllowed(policy, "chapter_read")).toBe(true);
		expect(isRuntimeToolAllowed(policy, "workflow_submit_step_output")).toBe(true);
		for (const denied of ["Write", "Edit", "Bash", "chapter_write", "pipeline_write", "Agent"]) {
			expect(isRuntimeToolAllowed(policy, denied)).toBe(false);
		}
	});

	test("an unknown name still fails closed to read-only", async () => {
		registerRuntimeProductIntegration(integrationWith([template()]));
		const trait = await compileDelegationCeiling("nf-unknown");
		expect(trait.readOnly).toBe(true);
	});
});
