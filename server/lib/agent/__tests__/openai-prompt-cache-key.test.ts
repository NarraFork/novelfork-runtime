import { describe, expect, test } from "bun:test";
import { applyOfficialPromptCacheKey } from "../openai-provider";

describe("applyOfficialPromptCacheKey", () => {
	test("official OpenAI Responses and Chat Completions get the conversation as cache key", () => {
		for (const mode of ["responses", "completions"] as const) {
			const body: Record<string, unknown> = {};
			applyOfficialPromptCacheKey(body, "https://api.openai.com/v1", mode, "narrator-1");
			expect(body.prompt_cache_key).toBe("narrator-1");
		}
	});

	test("compatible relays, codex and missing identity are left untouched", () => {
		const relay: Record<string, unknown> = {};
		applyOfficialPromptCacheKey(relay, "https://relay.example/v1", "responses", "narrator-1");
		expect(relay).toEqual({});

		const codex: Record<string, unknown> = {};
		applyOfficialPromptCacheKey(codex, "https://api.openai.com/v1", "codex", "narrator-1");
		expect(codex).toEqual({});

		const anonymous: Record<string, unknown> = {};
		applyOfficialPromptCacheKey(anonymous, "https://api.openai.com/v1", "responses", undefined);
		expect(anonymous).toEqual({});

		const invalid: Record<string, unknown> = {};
		applyOfficialPromptCacheKey(invalid, "not a url", "responses", "narrator-1");
		expect(invalid).toEqual({});
	});

	test("an existing key is never overwritten", () => {
		const body: Record<string, unknown> = { prompt_cache_key: "kept" };
		applyOfficialPromptCacheKey(body, "https://api.openai.com/v1", "responses", "narrator-1");
		expect(body.prompt_cache_key).toBe("kept");
	});
});
