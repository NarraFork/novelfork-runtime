import type { GenerateMetaResult, GenerateOptions, ProviderResolution } from "../agent/provider";
import type { TrackApiRequestOptions } from "../api-request-tracker";
import type {
	RuntimeProductHostServices,
	RuntimeProductTextGenerationRequest,
	RuntimeProductTextGenerationResult,
	RuntimeProductTextGenerationStatus,
	RuntimeProductTextMessage,
	RuntimeProductTextModelRole,
} from "./contracts";

/**
 * Tool-free text generation for product server code (for example NovelFork's
 * authenticated HTTP routes), outside any narrator session.
 *
 * It follows the same rules as the Runtime's own background generations
 * (titles, summaries, compaction):
 * - the model is resolved from the configured `default` / `summary` model
 *   reference at call time, never from product input and never from a
 *   hardcoded fallback;
 * - transient provider errors are retried with the auxiliary retry policy;
 * - every request is recorded through the API request tracker and attributed
 *   to the authenticated user (usage history, per-user and per-credential totals).
 *
 * Unlike the summary-model helpers it does not broadcast
 * `summary_model_unavailable` / `summary_model_error` to every client: the
 * product caller reports the failure to the one author who asked.
 *
 * Runtime modules are loaded lazily so that importing the product-host barrel
 * during product bootstrap never evaluates the agent/provider graph early.
 */

/** Seams for unit tests; production uses the lazily loaded Runtime modules. */
export interface RuntimeProductTextGenerationDeps {
	resolveModel(modelRole: RuntimeProductTextModelRole): Promise<ProviderResolution>;
	generate(
		resolution: ProviderResolution,
		text: string,
		systemInstruction: string | undefined,
		options: GenerateOptions,
		tracking: Omit<TrackApiRequestOptions, "provider" | "model">,
	): Promise<GenerateMetaResult>;
	retry<T>(fn: () => Promise<T>, signal: AbortSignal | undefined): Promise<T>;
}

const defaultDeps: RuntimeProductTextGenerationDeps = {
	async resolveModel(modelRole) {
		const [{ resolveProviderAndModel }, { FOLLOW_DEFAULT_MODEL, FOLLOW_SUMMARY_MODEL }] =
			await Promise.all([import("../agent/provider"), import("../settings/provider")]);
		return resolveProviderAndModel(
			modelRole === "summary" ? FOLLOW_SUMMARY_MODEL : FOLLOW_DEFAULT_MODEL,
		);
	},
	async generate(resolution, text, systemInstruction, options, tracking) {
		const { agentGenerateWithMetaResolved } = await import("../agent");
		return agentGenerateWithMetaResolved(text, resolution, systemInstruction, options, tracking);
	},
	async retry(fn, signal) {
		const { withAuxiliaryRetry } = await import("../agent");
		return withAuxiliaryRetry(fn, { signal, label: "Product text generation" });
	},
};

function normalizeModelRole(value: unknown): RuntimeProductTextModelRole {
	return value === "summary" ? "summary" : "default";
}

function isDefaultModelNotConfigured(error: unknown): boolean {
	return error instanceof Error && error.name === "DefaultModelNotConfiguredError";
}

/**
 * Fold a chat transcript into the single-turn shape of the lightweight generate
 * path. Same folding as `ToolContext.generateText`: system messages become the
 * system instruction; earlier turns are replayed as a labelled prefix; the
 * trailing user turn(s) form the request.
 */
export function foldProductTextMessages(messages: readonly RuntimeProductTextMessage[]): {
	systemInstruction: string | undefined;
	content: string;
} {
	const systemParts: string[] = [];
	const transcript: Array<{ role: "user" | "assistant"; content: string }> = [];
	for (const message of messages) {
		if (message.role === "system") {
			systemParts.push(message.content);
			continue;
		}
		transcript.push({ role: message.role, content: message.content });
	}
	const systemInstruction = systemParts.join("\n\n").trim() || undefined;
	let lastUserIndex = -1;
	for (let i = transcript.length - 1; i >= 0; i -= 1) {
		if (transcript[i]?.role === "user") {
			lastUserIndex = i;
			break;
		}
	}
	if (lastUserIndex < 0) {
		return { systemInstruction, content: transcript.map((item) => item.content).join("\n\n") };
	}
	const userContent = transcript
		.slice(lastUserIndex)
		.filter((item) => item.role === "user")
		.map((item) => item.content)
		.join("\n\n");
	const historyPrefix = transcript
		.slice(0, lastUserIndex)
		.map((item) => `${item.role === "assistant" ? "Assistant" : "User"}: ${item.content}`)
		.join("\n\n");
	return {
		systemInstruction,
		content: historyPrefix ? `${historyPrefix}\n\nUser: ${userContent}` : userContent,
	};
}

export function createRuntimeProductHostServices(
	deps: RuntimeProductTextGenerationDeps = defaultDeps,
): RuntimeProductHostServices {
	return {
		async getTextGenerationStatus(modelRoleInput) {
			const modelRole = normalizeModelRole(modelRoleInput);
			try {
				const resolution = await deps.resolveModel(modelRole);
				return {
					available: true,
					modelRole,
					provider: resolution.provider,
					model: resolution.model,
				} satisfies RuntimeProductTextGenerationStatus;
			} catch (error) {
				return {
					available: false,
					modelRole,
					code: isDefaultModelNotConfigured(error)
						? "MODEL_NOT_CONFIGURED"
						: "MODEL_PROVIDER_UNAVAILABLE",
					message: error instanceof Error ? error.message : String(error),
				} satisfies RuntimeProductTextGenerationStatus;
			}
		},

		async generateText(
			request: RuntimeProductTextGenerationRequest,
			options,
		): Promise<RuntimeProductTextGenerationResult> {
			const userId = typeof options?.userId === "string" ? options.userId.trim() : "";
			// Attribution is part of the contract: an unattributed product request would
			// escape per-user usage accounting, so it is refused rather than guessed.
			if (!userId) throw new Error("Product text generation requires an authenticated userId");
			const messages = Array.isArray(request?.messages) ? request.messages : [];
			const { systemInstruction, content } = foldProductTextMessages(messages);
			if (!content.trim())
				throw new Error("Product text generation requires a non-empty user message");

			const modelRole = normalizeModelRole(request.modelRole);
			const resolution = await deps.resolveModel(modelRole);
			const maxTokens =
				typeof request.maxTokens === "number" &&
				Number.isFinite(request.maxTokens) &&
				request.maxTokens > 0
					? Math.floor(request.maxTokens)
					: undefined;
			const generateOptions: GenerateOptions = {
				// The summary role mirrors the Runtime's own auxiliary generations; the
				// default role keeps the provider's configured reasoning default, as a
				// narrator without an override would.
				...(modelRole === "summary" ? { reasoningEffort: "none" as const } : {}),
				...(maxTokens !== undefined ? { maxOutputTokens: maxTokens } : {}),
				...(options.signal ? { signal: options.signal } : {}),
			};
			const tracking = { userId, kind: "external" as const };
			const result = await deps.retry(
				() => deps.generate(resolution, content, systemInstruction, generateOptions, tracking),
				options.signal,
			);
			const usage = result.usage
				? {
						promptTokens: result.usage.inputTokens,
						completionTokens: result.usage.outputTokens,
						totalTokens:
							typeof result.usage.inputTokens === "number" &&
							typeof result.usage.outputTokens === "number"
								? result.usage.inputTokens + result.usage.outputTokens
								: undefined,
					}
				: undefined;
			return {
				text: result.text,
				model: `${resolution.provider}:${resolution.model}`,
				...(result.outputTruncated ? { outputTruncated: true } : {}),
				...(usage ? { usage } : {}),
			};
		},
	};
}

/** Process-wide Runtime services for the registered product integration. */
export const runtimeProductHostServices: RuntimeProductHostServices =
	createRuntimeProductHostServices();
