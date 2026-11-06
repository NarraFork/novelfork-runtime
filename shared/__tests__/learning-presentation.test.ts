import { describe, expect, test } from "bun:test";
import {
	getLearningCategories,
	getLearningDoc,
	getLearningDocSummaries,
	getLearningDocs,
	learningDocExists,
	searchLearningDocs,
} from "../learning-content";
import type {
	RuntimeLearningContribution,
	RuntimeLearningDocumentContribution,
	RuntimeLearningPresentation,
} from "../learning-contract";

const t = (text: string) => ({ en: text, "zh-CN": text });

const contribution: RuntimeLearningContribution = {
	categories: [{ id: "product", label: t("Product"), description: t("Product docs") }],
	docs: [
		{
			id: "product-doc",
			category: "product",
			tags: ["product"],
			title: t("Built on NarraFork"),
			summary: t("Contributed text keeps NarraFork as written."),
			sections: [],
			workflow: [],
			bestPractices: [],
			pitfalls: [],
			agentHints: [],
			actions: [],
		},
	],
};

const presentation: RuntimeLearningPresentation = {
	brandName: "Acme",
	hiddenBuiltinDocIds: ["terminal-and-containers", "mcp-and-hooks"],
	builtinDocOverrides: {
		overview: { title: t("Acme at a glance"), summary: t("Overridden summary.") },
	},
	builtinCategoryOverrides: { start: { label: t("Begin") } },
	categoryOrder: ["product", "start"],
};

describe("learning presentation", () => {
	test("absent presentation keeps the Runtime's built-in content unchanged", () => {
		const plain = getLearningDocs("en", [contribution]);
		expect(getLearningDocs("en", [contribution], undefined)).toEqual(plain);
		expect(plain.find((doc) => doc.id === "overview")?.title).toBe("NarraFork in one page");
		expect(plain[0]?.id).toBe("overview");
		expect(getLearningDoc("terminal-and-containers", "en")).toBeDefined();
	});

	test("brand name replaces NarraFork in built-in text only", () => {
		const docs = getLearningDocs("zh-CN", [contribution], presentation);
		const builtin = docs.filter((doc) => doc.id !== "product-doc");
		expect(JSON.stringify(builtin)).not.toContain("NarraFork");
		expect(getLearningDoc("narrators", "zh-CN", [], presentation)?.summary).toContain("Acme");
		const contributed = docs.find((doc) => doc.id === "product-doc");
		expect(contributed?.title).toBe("Built on NarraFork");
		expect(contributed?.summary).toContain("NarraFork");
	});

	test("hidden built-in docs disappear from listing, search and lookup", () => {
		const ids = getLearningDocSummaries("en", [], presentation).map((doc) => doc.id);
		expect(ids).not.toContain("terminal-and-containers");
		expect(ids).not.toContain("mcp-and-hooks");
		expect(getLearningDoc("terminal-and-containers", "en", [], presentation)).toBeUndefined();
		expect(learningDocExists("mcp-and-hooks", [], presentation)).toBe(false);
		const searched = searchLearningDocs("terminal podman mcp hooks", "en", [], presentation).map(
			(doc) => doc.id,
		);
		expect(searched).not.toContain("terminal-and-containers");
		expect(searched).not.toContain("mcp-and-hooks");
	});

	test("a contribution cannot claim the id of a hidden built-in doc", () => {
		const takeover: RuntimeLearningContribution = {
			categories: [],
			docs: [
				{
					...(contribution.docs[0] as RuntimeLearningDocumentContribution),
					id: "terminal-and-containers",
				},
			],
		};
		expect(
			getLearningDoc("terminal-and-containers", "en", [takeover], presentation),
		).toBeUndefined();
	});

	test("overrides replace fields after branding and are searchable", () => {
		const overview = getLearningDoc("overview", "en", [], presentation);
		expect(overview?.title).toBe("Acme at a glance");
		expect(overview?.summary).toBe("Overridden summary.");
		expect(searchLearningDocs("glance", "en", [], presentation).map((doc) => doc.id)).toContain(
			"overview",
		);
		const start = getLearningCategories("en", [], presentation).find(
			(category) => category.id === "start",
		);
		expect(start?.label).toBe("Begin");
		expect(start?.description).toBe("Core concepts and the shortest path to productive use.");
	});

	test("category order moves listed categories and their docs first", () => {
		const categories = getLearningCategories("en", [contribution], presentation).map((c) => c.id);
		expect(categories.slice(0, 2)).toEqual(["product", "start"]);
		expect(categories.slice(2)).toEqual(["agent", "automation", "runtime", "admin"]);
		const docs = getLearningDocSummaries("en", [contribution], presentation);
		expect(docs[0]?.id).toBe("product-doc");
		expect(docs.slice(1, 3).map((doc) => doc.category)).toEqual(["start", "start"]);
	});
});
