import type { GenerateOptions, ProviderAdapter } from "./provider";
import type { ToolContext } from "./types";

type ToolGenerateText = NonNullable<ToolContext["generateText"]>;

/**
 * Build `ToolContext.generateText`: one-shot, tool-free generation on the narrator's own
 * provider and model, for tools (plugin domain tools such as chapter settlement) that need
 * structured model output outside the agent loop.
 *
 * It deliberately uses `generateWithMeta`, not `generateWithHistory*`. The history helpers
 * are the TITLE-generation path: the Anthropic/NUG adapters prepend "Reply with ONLY a short
 * title (max 50 chars)" to the user content and ignore the caller's token ceiling. A real
 * NUG/opus run of chapter settlement got a title back instead of the requested JSON, twice.
 *
 * System messages go to the provider's native system channel; earlier non-system turns are
 * folded into the single user prompt as a labelled transcript. `maxTokens` becomes the
 * provider output ceiling and `outputTruncated` is passed back so callers can tell a cut-off
 * answer from a malformed one.
 */
export function createToolGenerateText(
	resolveProvider: () => ProviderAdapter,
	config: {
		model: string;
		signal?: AbortSignal;
		reasoningEffort?: GenerateOptions["reasoningEffort"];
	},
): ToolGenerateText {
	return async (request) => {
		const provider = resolveProvider();
		const systemParts: string[] = [];
		const transcript: Array<{ role: "user" | "assistant"; content: string }> = [];
		for (const message of request.messages) {
			if (message.role === "system") {
				systemParts.push(message.content);
				continue;
			}
			transcript.push({ role: message.role, content: message.content });
		}
		const systemInstruction = systemParts.join("\n\n").trim();
		let lastUserIndex = -1;
		for (let i = transcript.length - 1; i >= 0; i -= 1) {
			if (transcript[i]?.role === "user") {
				lastUserIndex = i;
				break;
			}
		}
		const userContent =
			lastUserIndex >= 0
				? transcript
						.slice(lastUserIndex)
						.filter((item) => item.role === "user")
						.map((item) => item.content)
						.join("\n\n")
				: transcript.map((item) => item.content).join("\n\n");
		const historyPrefix = transcript
			.slice(0, Math.max(lastUserIndex, 0))
			.map((item) => `${item.role === "assistant" ? "Assistant" : "User"}: ${item.content}`)
			.join("\n\n");
		const content = historyPrefix ? `${historyPrefix}\n\nUser: ${userContent}` : userContent;

		const maxTokens =
			typeof request.maxTokens === "number" &&
			Number.isFinite(request.maxTokens) &&
			request.maxTokens > 0
				? Math.floor(request.maxTokens)
				: undefined;
		const options: GenerateOptions = {
			...(config.signal ? { signal: config.signal } : {}),
			...(config.reasoningEffort ? { reasoningEffort: config.reasoningEffort } : {}),
			...(maxTokens !== undefined ? { maxOutputTokens: maxTokens } : {}),
		};
		const result = await provider.generateWithMeta(
			content || " ",
			config.model,
			systemInstruction || undefined,
			options,
		);
		return {
			text: result.text,
			...(result.outputTruncated ? { outputTruncated: true } : {}),
			...(result.usage
				? {
						usage: {
							promptTokens: result.usage.inputTokens,
							completionTokens: result.usage.outputTokens,
							totalTokens:
								typeof result.usage.inputTokens === "number" &&
								typeof result.usage.outputTokens === "number"
									? result.usage.inputTokens + result.usage.outputTokens
									: undefined,
						},
					}
				: {}),
		};
	};
}
