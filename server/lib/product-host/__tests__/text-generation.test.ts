import { describe, expect, test } from "bun:test";
import type { GenerateMetaResult, GenerateOptions, ProviderResolution } from "../../agent/provider";
import type { TrackApiRequestOptions } from "../../api-request-tracker";
import { settings } from "../../settings";
import { DefaultModelNotConfiguredError } from "../../settings/provider";
import type { RuntimeProductTextModelRole } from "../contracts";
import { runtimeProductHostServices } from "../index";
import {
	createRuntimeProductHostServices,
	foldProductTextMessages,
	type RuntimeProductTextGenerationDeps,
} from "../text-generation";

type GenerateCall = {
	resolution: ProviderResolution;
	text: string;
	systemInstruction: string | undefined;
	options: GenerateOptions;
	tracking: Omit<TrackApiRequestOptions, "provider" | "model">;
};

function resolution(provider: string, model: string): ProviderResolution {
	return {
		requestedProvider: provider,
		requestedModel: `${provider}:${model}`,
		provider,
		model,
		adapter: {} as ProviderResolution["adapter"],
	};
}

function fakeDeps(overrides: Partial<RuntimeProductTextGenerationDeps> = {}) {
	const roles: RuntimeProductTextModelRole[] = [];
	const calls: GenerateCall[] = [];
	let retries = 0;
	const deps: RuntimeProductTextGenerationDeps = {
		async resolveModel(role) {
			roles.push(role);
			return role === "summary" ? resolution("nug", "cheap") : resolution("anthropic", "main");
		},
		async generate(res, text, systemInstruction, options, tracking): Promise<GenerateMetaResult> {
			calls.push({ resolution: res, text, systemInstruction, options, tracking });
			return { text: "生成结果", usage: { inputTokens: 12, outputTokens: 30 } };
		},
		async retry(fn) {
			retries += 1;
			return fn();
		},
		...overrides,
	};
	return { deps, roles, calls, retries: () => retries };
}

describe("product host text generation", () => {
	test("generates with the default model and attributes usage to the user", async () => {
		const { deps, roles, calls, retries } = fakeDeps();
		const services = createRuntimeProductHostServices(deps);

		const result = await services.generateText(
			{
				messages: [
					{ role: "system", content: "你是写作助手" },
					{ role: "user", content: "续写一段" },
				],
				temperature: 0.7,
				maxTokens: 2048,
			},
			{ userId: "user-1" },
		);

		expect(roles).toEqual(["default"]);
		expect(retries()).toBe(1);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.text).toBe("续写一段");
		expect(calls[0]?.systemInstruction).toBe("你是写作助手");
		expect(calls[0]?.options).toEqual({ maxOutputTokens: 2048 });
		expect(calls[0]?.tracking).toEqual({ userId: "user-1", kind: "external" });
		expect(result).toEqual({
			text: "生成结果",
			model: "anthropic:main",
			usage: { promptTokens: 12, completionTokens: 30, totalTokens: 42 },
		});
	});

	test("summary role follows the summary model without reasoning, like titles and compaction", async () => {
		const { deps, roles, calls } = fakeDeps();
		const services = createRuntimeProductHostServices(deps);
		const signal = new AbortController().signal;

		const result = await services.generateText(
			{ messages: [{ role: "user", content: "总结" }], modelRole: "summary" },
			{ userId: "user-2", signal },
		);

		expect(roles).toEqual(["summary"]);
		expect(calls[0]?.options).toEqual({ reasoningEffort: "none", signal });
		expect(result.model).toBe("nug:cheap");
	});

	test("refuses unattributed or empty requests before resolving a model", async () => {
		const { deps, roles } = fakeDeps();
		const services = createRuntimeProductHostServices(deps);

		await expect(
			services.generateText({ messages: [{ role: "user", content: "x" }] }, { userId: "  " }),
		).rejects.toThrow("requires an authenticated userId");
		await expect(
			services.generateText(
				{ messages: [{ role: "system", content: "only system" }] },
				{ userId: "u" },
			),
		).rejects.toThrow("non-empty user message");
		expect(roles).toEqual([]);
	});

	test("reports truncated output and propagates model resolution errors", async () => {
		const truncated = fakeDeps({
			async generate() {
				return { text: "半段", outputTruncated: true };
			},
		});
		const result = await createRuntimeProductHostServices(truncated.deps).generateText(
			{ messages: [{ role: "user", content: "写" }] },
			{ userId: "u" },
		);
		expect(result).toEqual({ text: "半段", model: "anthropic:main", outputTruncated: true });

		const unconfigured = fakeDeps({
			async resolveModel() {
				throw new DefaultModelNotConfiguredError();
			},
		});
		await expect(
			createRuntimeProductHostServices(unconfigured.deps).generateText(
				{ messages: [{ role: "user", content: "写" }] },
				{ userId: "u" },
			),
		).rejects.toMatchObject({ name: "DefaultModelNotConfiguredError" });
		expect(unconfigured.calls).toHaveLength(0);
	});

	test("status tells an unconfigured model apart from an unusable provider", async () => {
		const available = await createRuntimeProductHostServices(
			fakeDeps().deps,
		).getTextGenerationStatus();
		expect(available).toEqual({
			available: true,
			modelRole: "default",
			provider: "anthropic",
			model: "main",
		});

		const notConfigured = await createRuntimeProductHostServices(
			fakeDeps({
				async resolveModel() {
					throw new DefaultModelNotConfiguredError();
				},
			}).deps,
		).getTextGenerationStatus("summary");
		expect(notConfigured).toMatchObject({
			available: false,
			modelRole: "summary",
			code: "MODEL_NOT_CONFIGURED",
		});

		const providerGone = await createRuntimeProductHostServices(
			fakeDeps({
				async resolveModel() {
					throw new Error('Provider "gone" is not configured.');
				},
			}).deps,
		).getTextGenerationStatus();
		expect(providerGone).toMatchObject({ available: false, code: "MODEL_PROVIDER_UNAVAILABLE" });
	});

	test("folds multi-turn transcripts the same way as ToolContext.generateText", () => {
		expect(
			foldProductTextMessages([
				{ role: "system", content: "S1" },
				{ role: "user", content: "问一" },
				{ role: "assistant", content: "答一" },
				{ role: "system", content: "S2" },
				{ role: "user", content: "问二" },
			]),
		).toEqual({
			systemInstruction: "S1\n\nS2",
			content: "User: 问一\n\nAssistant: 答一\n\nUser: 问二",
		});
	});
});

describe("product host text generation with the real Runtime model settings", () => {
	test("a fresh install has no default model and says so instead of inventing one", async () => {
		settings.agent.defaultModel = "";
		settings.agent.summaryModel = "";

		const status = await runtimeProductHostServices.getTextGenerationStatus();
		expect(status).toMatchObject({ available: false, code: "MODEL_NOT_CONFIGURED" });
		const summaryStatus = await runtimeProductHostServices.getTextGenerationStatus("summary");
		expect(summaryStatus).toMatchObject({ available: false, code: "MODEL_NOT_CONFIGURED" });

		await expect(
			runtimeProductHostServices.generateText(
				{ messages: [{ role: "user", content: "写" }] },
				{ userId: "user-1" },
			),
		).rejects.toMatchObject({ name: "DefaultModelNotConfiguredError" });
	});

	test("a default model on an unconfigured provider is reported as unavailable", async () => {
		settings.agent.defaultModel = "novelfork-missing-provider:some-model";

		const status = await runtimeProductHostServices.getTextGenerationStatus();
		expect(status).toMatchObject({ available: false, code: "MODEL_PROVIDER_UNAVAILABLE" });
	});
});
