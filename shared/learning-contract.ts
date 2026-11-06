/**
 * Product-neutral learning content contract shared by the Runtime route and
 * optional product integrations. Keeping it in shared avoids a shared -> server
 * dependency while preserving a narrow, serializable contribution surface.
 */
export interface RuntimeLearningLocalizedText {
	readonly en: string;
	readonly "zh-CN": string;
}

export interface RuntimeLearningCategoryContribution {
	readonly id: string;
	readonly label: RuntimeLearningLocalizedText;
	readonly description: RuntimeLearningLocalizedText;
}

export interface RuntimeLearningActionContribution {
	readonly label: RuntimeLearningLocalizedText;
	readonly description: RuntimeLearningLocalizedText;
	readonly href: string;
}

export interface RuntimeLearningDocumentContribution {
	readonly id: string;
	readonly category: string;
	readonly tags: readonly string[];
	readonly title: RuntimeLearningLocalizedText;
	readonly summary: RuntimeLearningLocalizedText;
	readonly sections: readonly {
		readonly title: RuntimeLearningLocalizedText;
		readonly body: RuntimeLearningLocalizedText;
	}[];
	readonly workflow: readonly RuntimeLearningLocalizedText[];
	readonly bestPractices: readonly RuntimeLearningLocalizedText[];
	readonly pitfalls: readonly RuntimeLearningLocalizedText[];
	readonly agentHints: readonly RuntimeLearningLocalizedText[];
	readonly actions: readonly RuntimeLearningActionContribution[];
}

export interface RuntimeLearningContribution {
	readonly categories: readonly RuntimeLearningCategoryContribution[];
	readonly docs: readonly RuntimeLearningDocumentContribution[];
}

/** Fields a product may replace on one built-in learning document. */
export type RuntimeLearningDocumentOverride = Partial<
	Pick<
		RuntimeLearningDocumentContribution,
		| "category"
		| "tags"
		| "title"
		| "summary"
		| "sections"
		| "workflow"
		| "bestPractices"
		| "pitfalls"
		| "agentHints"
		| "actions"
	>
>;

/** Fields a product may replace on one built-in learning category. */
export type RuntimeLearningCategoryOverride = Partial<
	Pick<RuntimeLearningCategoryContribution, "label" | "description">
>;

/**
 * How a product presents the Runtime's BUILT-IN learning documents. Only
 * built-in content is affected; product-contributed documents are shown as
 * written. Absent means the Runtime's own presentation, unchanged.
 */
export interface RuntimeLearningPresentation {
	/** Replaces the literal "NarraFork" in built-in document and category text. */
	readonly brandName?: string;
	/** Built-in documents removed from listing, search and lookup by id. */
	readonly hiddenBuiltinDocIds?: readonly string[];
	/** Per-document field replacements, applied after the brand substitution. */
	readonly builtinDocOverrides?: Readonly<Record<string, RuntimeLearningDocumentOverride>>;
	/** Per-category label/description replacements for built-in categories. */
	readonly builtinCategoryOverrides?: Readonly<Record<string, RuntimeLearningCategoryOverride>>;
	/**
	 * Category ids shown first, in this order; unlisted categories keep their
	 * original relative order after them. Documents follow their category's rank.
	 */
	readonly categoryOrder?: readonly string[];
}
