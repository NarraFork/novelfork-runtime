import {
	getLearningCategories,
	getLearningDoc,
	getLearningDocSummaries,
	searchLearningDocs,
} from "@shared/learning-content";
import { getRuntimeProductIntegration } from "@server/lib/product-host";
import { Hono } from "hono";

const productLearningContributions = getRuntimeProductIntegration().learningContributions?.() ?? [];

export const learningRoutes = new Hono();

learningRoutes.get("/", (c) => {
	const lang = c.req.query("lang");
	return c.json({
		categories: getLearningCategories(lang, productLearningContributions),
		docs: getLearningDocSummaries(lang, productLearningContributions),
	});
});

learningRoutes.get("/search", (c) => {
	const lang = c.req.query("lang");
	const query = c.req.query("q") ?? "";
	return c.json({ results: searchLearningDocs(query, lang, productLearningContributions) });
});

learningRoutes.get("/:id", (c) => {
	const lang = c.req.query("lang");
	const doc = getLearningDoc(c.req.param("id"), lang, productLearningContributions);
	if (!doc) return c.json({ error: "Learning document not found" }, 404);
	return c.json(doc);
});
