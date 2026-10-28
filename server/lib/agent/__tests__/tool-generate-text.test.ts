import { describe, expect, test } from "bun:test";
import type { GenerateOptions, ProviderAdapter } from "../provider";
import { createToolGenerateText } from "../tool-generate-text";

type Call = { text: string; model: string; system?: string; options?: GenerateOptions };

function fakeProvider(result: { text: string; outputTruncated?: boolean }) {
	const calls: Call[] = [];
	const historyCalls: unknown[] = [];
	const provider = {
		generateWithMeta: async (
			text: string,
			model: string,
			system?: string,
			options?: GenerateOptions,
		) => {
			calls.push({ text, model, system, options });
			return { ...result, usage: { inputTokens: 10, outputTokens: 5 } };
		},
		// The title path must never be used for tool generation.
		generateWithHistory: async (...args: unknown[]) => {
			historyCalls.push(args);
			return "标题";
		},
		generateWithHistoryWithMeta: async (...args: unknown[]) => {
			historyCalls.push(args);
			return { text: "标题" };
		},
	} as unknown as ProviderAdapter;
	return { provider, calls, historyCalls };
}

describe("tool ctx.generateText", () => {
	test("uses generateWithMeta with native system, the caller's token ceiling and no title reminder path", async () => {
		const { provider, calls, historyCalls } = fakeProvider({ text: '{"events":[]}' });
		const generate = createToolGenerateText(() => provider, { model: "nug:kiro:claude-opus-5.5" });

		const result = await generate({
			messages: [
				{ role: "system", content: "返回严格 JSON 对象" },
				{ role: "user", content: "第1章正文" },
			],
			maxTokens: 8000,
		});

		expect(historyCalls).toHaveLength(0);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.system).toBe("返回严格 JSON 对象");
		expect(calls[0]?.text).toBe("第1章正文");
		expect(calls[0]?.model).toBe("nug:kiro:claude-opus-5.5");
		expect(calls[0]?.options?.maxOutputTokens).toBe(8000);
		expect(result.text).toBe('{"events":[]}');
		expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
		expect(result.outputTruncated).toBeUndefined();
	});

	test("reports output truncation so callers can tell a cut-off answer from malformed JSON", async () => {
		const { provider } = fakeProvider({ text: '{"events":[', outputTruncated: true });
		const generate = createToolGenerateText(() => provider, { model: "m" });
		const result = await generate({ messages: [{ role: "user", content: "x" }] });
		expect(result.outputTruncated).toBe(true);
	});

	test("folds earlier turns into a labelled transcript and omits an empty system", async () => {
		const { provider, calls } = fakeProvider({ text: "ok" });
		const generate = createToolGenerateText(() => provider, {
			model: "m",
			reasoningEffort: "low",
		});
		await generate({
			messages: [
				{ role: "user", content: "问" },
				{ role: "assistant", content: "答" },
				{ role: "user", content: "再问" },
			],
		});
		expect(calls[0]?.system).toBeUndefined();
		expect(calls[0]?.text).toBe("User: 问\n\nAssistant: 答\n\nUser: 再问");
		expect(calls[0]?.options?.reasoningEffort).toBe("low");
		expect(calls[0]?.options?.maxOutputTokens).toBeUndefined();
	});
});
