import type {
	RuntimeLearningContribution,
} from "../../../shared/learning-contract";
import type { Hono } from "hono";
import type { ToolDefinition } from "../agent/types";

export type {
	RuntimeLearningActionContribution,
	RuntimeLearningCategoryContribution,
	RuntimeLearningContribution,
	RuntimeLearningDocumentContribution,
	RuntimeLearningLocalizedText,
} from "../../../shared/learning-contract";

export type RuntimeToolRisk = "read" | "draft-write" | "confirmed-write" | "destructive";
export type SessionPermissionMode = "ask" | "edit" | "allow" | "read" | "plan";
export type ToolVisibility = "author" | "advanced";

export interface ContributedToolPermissionPolicy {
	readonly risk: RuntimeToolRisk;
	readonly enabledForModes: readonly SessionPermissionMode[];
	readonly visibility: ToolVisibility;
	readonly resolveRisk?: (input?: Record<string, unknown>) => RuntimeToolRisk;
}

export interface RuntimeResourceBinding {
	readonly kind: string;
	readonly root: string;
	readonly [key: string]: unknown;
}

/** Trusted product context. It must never be populated from model tool input. */
export interface RuntimeResolveContext {
	readonly runtimeProjectId: string;
	readonly projectRoot: string;
	readonly projectType: string;
	readonly enabledPluginIds: readonly string[];
	readonly sessionId?: string;
	readonly resourceBindings: Readonly<Record<string, RuntimeResourceBinding>>;
}

/** Minimal resolved tool shape consumed by the generic Runtime. */
export interface RuntimeResolvedToolContribution {
	readonly definition: Readonly<{
		name: string;
		risk?: RuntimeToolRisk;
		enabledForModes?: readonly SessionPermissionMode[];
		visibility?: ToolVisibility;
		resolveRisk?: (input?: Record<string, unknown>) => RuntimeToolRisk;
		renderer?: string;
	}>;
}

/** Minimal prompt extension shape consumed by the generic Runtime. */
export interface RuntimeResolvedPromptExtension {
	readonly content: string;
}

/** Product contribution aggregate projected onto the fields consumed by Runtime. */
export interface ResolvedRuntimeContributions {
	readonly tools: readonly RuntimeResolvedToolContribution[];
	readonly promptExtensions: readonly RuntimeResolvedPromptExtension[];
}

export type RuntimeProductAccessDeniedEvent = Readonly<{
	type: "error";
	code: string;
	message: string;
	narratorId?: string;
}>;

/**
 * Product-owned adapter for a narrator's trusted domain contributions. The
 * Runtime only consumes these generic operations; the product owns bindings,
 * tool implementations, prompts, and allowlist policy.
 */
export interface RuntimeProductNarratorAdapter {
	resolve(narratorId: string): Promise<RuntimeResolveContext | null>;
	resolveContribution(narratorId: string): Promise<ResolvedRuntimeContributions | null>;
	resolveToolNames(narratorId: string): Promise<readonly string[]>;
	resolveTrustedPromptRoot(narratorId: string): Promise<string | null>;
	toolDefinitions(): ToolDefinition[];
	isToolAllowed(
		toolName: string,
		enabledOptionalToolNames: ReadonlySet<string>,
		context?: Readonly<{ permissionMode?: SessionPermissionMode | string; isAdvancedEnabled?: boolean }>,
	): boolean;
	getToolPermissionPolicy?(toolName: string): ContributedToolPermissionPolicy | null;
	syncToolVisibility(
		enabledToolNames: Set<string>,
		resolvedToolNames: readonly string[],
		context?: Readonly<{ isAdvancedEnabled?: boolean; permissionMode?: SessionPermissionMode | string }>,
	): void;
}

/**
 * Which configured Runtime model a product generation follows. `default` is the
 * model a narrator uses when it has no override; `summary` is the auxiliary
 * model behind titles, summaries and compaction (it follows `default` when unset).
 */
export type RuntimeProductTextModelRole = "default" | "summary";

export type RuntimeProductTextMessage = Readonly<{
	role: "system" | "user" | "assistant";
	content: string;
}>;

/**
 * Tool-free text generation request. Mirrors `ToolContext.generateText` so product
 * code can share one generator shape between narrator tools and HTTP routes.
 */
export interface RuntimeProductTextGenerationRequest {
	readonly messages: readonly RuntimeProductTextMessage[];
	/**
	 * Accepted for signature parity with `ToolContext.generateText`. The Runtime's
	 * lightweight generate path does not forward sampling temperature, so it is
	 * currently ignored.
	 */
	readonly temperature?: number;
	/** Provider output-token ceiling. */
	readonly maxTokens?: number;
	/** Defaults to `default`. */
	readonly modelRole?: RuntimeProductTextModelRole;
}

/** Trusted caller identity. Never populated from request bodies or model output. */
export interface RuntimeProductTextGenerationOptions {
	/** Authenticated Runtime user the request is attributed to in usage accounting. */
	readonly userId: string;
	readonly signal?: AbortSignal;
}

export interface RuntimeProductTextGenerationResult {
	readonly text: string;
	/** Concrete `provider:model` that served the request. */
	readonly model: string;
	/** True when the provider stopped at the output-token ceiling. */
	readonly outputTruncated?: boolean;
	readonly usage?: Readonly<{
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
	}>;
}

export type RuntimeProductTextGenerationUnavailableCode =
	| "MODEL_NOT_CONFIGURED"
	| "MODEL_PROVIDER_UNAVAILABLE";

export type RuntimeProductTextGenerationStatus =
	| Readonly<{
			available: true;
			modelRole: RuntimeProductTextModelRole;
			provider: string;
			model: string;
	  }>
	| Readonly<{
			available: false;
			modelRole: RuntimeProductTextModelRole;
			code: RuntimeProductTextGenerationUnavailableCode;
			message: string;
	  }>;

/**
 * Runtime-owned services a product may call from its authenticated server code.
 * The product never sees provider credentials: model choice, provider routing,
 * retries and per-user usage accounting all stay inside the Runtime.
 */
export interface RuntimeProductHostServices {
	getTextGenerationStatus(
		modelRole?: RuntimeProductTextModelRole,
	): Promise<RuntimeProductTextGenerationStatus>;
	generateText(
		request: RuntimeProductTextGenerationRequest,
		options: RuntimeProductTextGenerationOptions,
	): Promise<RuntimeProductTextGenerationResult>;
}

/**
 * Optional, host-owned product integration. A standalone NarraFork Runtime uses
 * the Null implementation; a product entrypoint must register its integration
 * before the Runtime server graph is loaded.
 */
export interface RuntimeProductIntegration {
	readonly id: string;
	initialize?(): void | Promise<void>;
	shutdown?(): void | Promise<void>;
	mountAuthenticatedGuards?(app: Hono): void;
	mountAuthenticatedRoutes?(app: Hono): void;
	mountRuntimeBindingRoutes?(app: Hono): void;
	learningContributions?(): readonly RuntimeLearningContribution[];
	narrator?: RuntimeProductNarratorAdapter;
	isProductNarrator?(traits: unknown): boolean;
	resolveNarratorCwd?(
		input: Readonly<{
			traits: unknown;
			narratorCwd: string | null | undefined;
			worktreePath: string | null | undefined;
			projectGitPath: string | null | undefined;
			fallbackCwd: string;
		}>,
	): string;
	canAccessNarratorState?(input: Readonly<{ userId: string | undefined; narratorId: string }>): Promise<boolean>;
	canAccessPermission?(input: Readonly<{ userId: string | undefined; requestId: string }>): Promise<boolean>;
	createNarratorAccessDeniedEvent?(narratorId?: string): RuntimeProductAccessDeniedEvent;
}
