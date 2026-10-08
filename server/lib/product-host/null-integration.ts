import type { RuntimeProductAccessDeniedEvent, RuntimeProductIntegration } from "./contracts";

/** Standalone NarraFork Runtime behavior: no product routes, tools, or policy. */
export const nullRuntimeProductIntegration: RuntimeProductIntegration = Object.freeze({
	id: "runtime.null",
	learningContributions: () => [],
	canAccessNarratorState: async () => true,
	canAccessPermission: async () => true,
	createNarratorAccessDeniedEvent: (narratorId: string | undefined): RuntimeProductAccessDeniedEvent => ({
		type: "error",
		code: "NARRATOR_ACCESS_DENIED",
		message: "Narrator access denied",
		...(narratorId ? { narratorId } : {}),
	}),
});
