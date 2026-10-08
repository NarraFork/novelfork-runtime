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
