import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import matter from "gray-matter";
import { AppError, NotFoundError, ValidationError } from "../lib/errors";
import { logger } from "../lib/logger";
import type { RuntimePolicyTrait } from "../lib/runtime-policy-trait";
import type { RuntimeProductSubagentTemplate } from "../lib/product-host/contracts";
import { getProductSubagentTemplates } from "../lib/product-host/subagent-templates";
import { narraforkDir } from "../lib/settings";
import { BUILTIN_DELEGATION_TEMPLATES, compileDelegationPolicy } from "./agent-runtime/policy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolAccessMode = "readOnly" | "general" | "custom";

export interface CustomSubagentDef {
	/** Unique identifier (directory name, e.g. "security-reviewer") */
	name: string;
	/** Human-readable description */
	description: string;
	/** Tool access mode */
	toolAccess: ToolAccessMode;
	/** Explicit tool list when toolAccess === "custom" */
	customTools: string[];
	/** Default model override (empty string = inherit from parent) */
	defaultModel: string;
	/** System prompt (markdown body) */
	prompt: string;
	/** Absolute path to the SUBAGENT.md file; `product:<productId>/<id>` for product templates */
	location: string;
	/** Where the definition comes from. Absent means a user SUBAGENT.md. */
	source?: "user" | "product";
	/** Product templates cannot be edited or deleted through this service. */
	readOnly?: boolean;
	/** Localized display names (product templates only). */
	nameZh?: string;
	nameEn?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUILTIN_TYPES = new Set(["explore", "plan", "general", "review"]);
/** Names product templates may never take: every built-in template and type. */
const RESERVED_TEMPLATE_NAMES: ReadonlySet<string> = new Set([
	...BUILTIN_TYPES,
	...BUILTIN_DELEGATION_TEMPLATES,
]);
const SUBAGENTS_DIR = join(narraforkDir, "subagents");
const SUBAGENT_FILE = "SUBAGENT.md";

// ---------------------------------------------------------------------------
// mtime-based cache
// ---------------------------------------------------------------------------

interface CachedDef {
	mtimeMs: number;
	def: CustomSubagentDef;
}

const defCache = new Map<string, CachedDef>();

async function getMtimeMs(filePath: string): Promise<number | null> {
	try {
		const s = await stat(filePath);
		return s.mtimeMs;
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function parseSubagentFile(
	raw: string,
	location: string,
	dirName: string,
): CustomSubagentDef | null {
	try {
		const { data, content } = matter(raw);

		const name = typeof data.name === "string" ? data.name.trim() : dirName;
		const description = typeof data.description === "string" ? data.description.trim() : "";
		if (!name) {
			logger.warn("Custom subagent missing name", { location });
			return null;
		}

		const toolAccess: ToolAccessMode =
			data.toolAccess === "general" || data.toolAccess === "custom" ? data.toolAccess : "readOnly";

		const customTools: string[] = Array.isArray(data.customTools)
			? data.customTools.filter((t: unknown) => typeof t === "string")
			: [];

		const defaultModel = typeof data.defaultModel === "string" ? data.defaultModel.trim() : "";

		return {
			name,
			description,
			toolAccess,
			customTools,
			defaultModel,
			prompt: content.trim(),
			location,
		};
	} catch (err) {
		logger.warn("Failed to parse custom subagent file", { location, error: String(err) });
		return null;
	}
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function loadCached(filePath: string, dirName: string): Promise<CustomSubagentDef | null> {
	const mtimeMs = await getMtimeMs(filePath);
	if (mtimeMs === null) return null;

	const cached = defCache.get(filePath);
	if (cached && cached.mtimeMs === mtimeMs) return cached.def;

	const raw = await readFile(filePath, "utf-8");
	const def = parseSubagentFile(raw, filePath, dirName);
	if (!def) {
		defCache.delete(filePath);
		return null;
	}

	defCache.set(filePath, { mtimeMs, def });
	return def;
}

// ---------------------------------------------------------------------------
// Product templates
// ---------------------------------------------------------------------------

function productTemplateDef(template: RuntimeProductSubagentTemplate): CustomSubagentDef {
	return {
		name: template.id,
		description: template.description,
		toolAccess: "custom",
		customTools: [...template.tools],
		defaultModel: template.defaultModel ?? "",
		prompt: template.prompt,
		location: `product:${template.id}`,
		source: "product",
		readOnly: true,
		nameZh: template.nameZh,
		nameEn: template.nameEn,
	};
}

function productTemplates(): readonly RuntimeProductSubagentTemplate[] {
	return getProductSubagentTemplates(RESERVED_TEMPLATE_NAMES);
}

function findProductTemplate(name: string): RuntimeProductSubagentTemplate | null {
	const key = name.trim().toLowerCase();
	if (!key) return null;
	return productTemplates().find((template) => template.id === key) ?? null;
}

/** Whether a name (as typed, or as its directory form) belongs to a product template. */
export function isProductTemplateName(name: string): boolean {
	return findProductTemplate(name) !== null || findProductTemplate(sanitizeDirName(name)) !== null;
}

function assertNotProductTemplateName(name: string): void {
	if (isProductTemplateName(name)) {
		throw new ValidationError(`"${name}" is a built-in product subagent and cannot be used`);
	}
}

/**
 * Load all subagent definitions: product templates first, then the user's
 * custom definitions from ~/.narrafork/subagents/ (a user file whose name a
 * product template already takes is shadowed and not listed).
 */
export async function loadAll(): Promise<CustomSubagentDef[]> {
	const products = productTemplates().map(productTemplateDef);
	const userDefs = await loadAllUserDefs();
	return [
		...products,
		...userDefs.filter((def) => !isProductTemplateName(def.name) && !isProductTemplateName(basename(dirname(def.location)))),
	];
}

async function loadAllUserDefs(): Promise<CustomSubagentDef[]> {
	const defs: CustomSubagentDef[] = [];
	try {
		const entries = await readdir(SUBAGENTS_DIR, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const filePath = join(SUBAGENTS_DIR, entry.name, SUBAGENT_FILE);
			const def = await loadCached(filePath, entry.name);
			if (def) defs.push(def);
		}
	} catch {
		// Directory doesn't exist yet — that's fine
	}
	return defs;
}

/** Load a single subagent definition by name; product templates take precedence. */
export async function loadByName(name: string): Promise<CustomSubagentDef | null> {
	const product = findProductTemplate(name);
	if (product) return productTemplateDef(product);
	return loadUserDefByName(name);
}

async function loadUserDefByName(name: string): Promise<CustomSubagentDef | null> {
	const dirName = sanitizeDirName(name);
	if (!dirName) return null;
	const filePath = join(SUBAGENTS_DIR, dirName, SUBAGENT_FILE);
	return loadCached(filePath, dirName);
}

/** Check whether a name refers to a built-in subagent type. */
export function isBuiltinType(name: string): boolean {
	return BUILTIN_TYPES.has(name);
}

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

function sanitizeDirName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fff_-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

function buildSubagentMd(def: Omit<CustomSubagentDef, "location">): string {
	const fm: Record<string, unknown> = {
		name: def.name,
		description: def.description,
		toolAccess: def.toolAccess,
	};
	if (def.toolAccess === "custom" && def.customTools.length > 0) {
		fm.customTools = def.customTools;
	}
	if (def.defaultModel) {
		fm.defaultModel = def.defaultModel;
	}
	return matter.stringify(`\n${def.prompt}\n`, fm);
}

export async function create(
	input: Omit<CustomSubagentDef, "location">,
): Promise<CustomSubagentDef> {
	if (isBuiltinType(input.name)) {
		throw new ValidationError(`"${input.name}" is a built-in subagent type and cannot be used`);
	}
	assertNotProductTemplateName(input.name);
	const dirName = sanitizeDirName(input.name);
	if (!dirName) throw new ValidationError("Invalid subagent name");

	const dir = join(SUBAGENTS_DIR, dirName);
	const filePath = join(dir, SUBAGENT_FILE);

	const dirExists = await stat(dir).then(
		() => true,
		() => false,
	);
	if (dirExists) throw new ValidationError(`Custom subagent directory already exists: ${dirName}`);

	await mkdir(dir, { recursive: true });
	await writeFile(filePath, buildSubagentMd(input), "utf-8");
	defCache.delete(filePath);

	const def = await loadCached(filePath, dirName);
	if (!def) throw new AppError("Failed to create custom subagent — parse error", 500);
	return def;
}

export async function update(
	currentName: string,
	input: Omit<CustomSubagentDef, "location">,
): Promise<CustomSubagentDef> {
	if (isProductTemplateName(currentName)) {
		throw new ValidationError(`"${currentName}" is a built-in product subagent and is read-only`);
	}
	assertNotProductTemplateName(input.name);
	const existing = await loadUserDefByName(currentName);
	if (!existing) throw new NotFoundError("Custom subagent", currentName);

	const oldDir = dirname(existing.location);
	// basename, not split("/"): on Windows `join` yields backslashes.
	const oldDirName = basename(oldDir);
	const newDirName = sanitizeDirName(input.name);
	if (!newDirName) throw new ValidationError("Invalid subagent name");

	const needsRename = newDirName !== oldDirName;

	if (needsRename) {
		if (isBuiltinType(input.name)) {
			throw new ValidationError(`"${input.name}" is a built-in subagent type and cannot be used`);
		}
		const newDir = join(SUBAGENTS_DIR, newDirName);
		const newDirExists = await stat(newDir).then(
			() => true,
			() => false,
		);
		if (newDirExists) {
			throw new ValidationError(`Custom subagent directory already exists: ${newDirName}`);
		}
		// Rename first, then write — avoids corrupting the old file if rename fails
		defCache.delete(existing.location);
		await rename(oldDir, newDir);

		const newFilePath = join(newDir, SUBAGENT_FILE);
		await writeFile(newFilePath, buildSubagentMd(input), "utf-8");

		const def = await loadCached(newFilePath, newDirName);
		if (!def) throw new AppError("Failed to update custom subagent — parse error", 500);
		return def;
	}

	// No rename — just update the file in place
	await writeFile(existing.location, buildSubagentMd(input), "utf-8");
	defCache.delete(existing.location);

	const def = await loadCached(existing.location, oldDirName);
	if (!def) throw new AppError("Failed to update custom subagent — parse error", 500);
	return def;
}

export async function remove(name: string): Promise<void> {
	if (isProductTemplateName(name)) {
		throw new ValidationError(`"${name}" is a built-in product subagent and is read-only`);
	}
	const existing = await loadUserDefByName(name);
	if (!existing) throw new NotFoundError("Custom subagent", name);

	const dir = dirname(existing.location);
	defCache.delete(existing.location);
	await rm(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Compile a delegation template, loading its custom definition when it is not built
 * in, into the ceiling trait stored on the created narrator. Every creation path
 * (live delegation, review conversion, session import) uses this, so stored rows
 * carry their ceiling and runtime never re-reads the template.
 */
export async function compileDelegationCeiling(
	template: string,
	options: { outlineSession?: boolean } = {},
): Promise<RuntimePolicyTrait> {
	return compileDelegationPolicy({
		template,
		customDefinition: BUILTIN_DELEGATION_TEMPLATES.has(template)
			? null
			: await loadByName(template),
		outlineSession: options.outlineSession,
	});
}

export const customSubagentService = {
	loadAll,
	loadByName,
	isBuiltinType,
	isProductTemplateName,
	create,
	update,
	remove,
};
