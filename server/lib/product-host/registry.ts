import type { RuntimeProductIntegration } from "./contracts";
import { nullRuntimeProductIntegration } from "./null-integration";

let integration: RuntimeProductIntegration = nullRuntimeProductIntegration;
let registered = false;
let locked = false;

/**
 * Configure the process-wide product integration before importing the Runtime
 * server graph. Deliberately rejects late replacement so routes, tool providers,
 * and lifecycle hooks cannot observe different products in one process.
 */
export function registerRuntimeProductIntegration(candidate: RuntimeProductIntegration): void {
	if (locked) {
		throw new Error("Runtime product integration must be registered before the Runtime is loaded");
	}
	if (registered) {
		throw new Error(`Runtime product integration is already registered: ${integration.id}`);
	}
	if (!candidate.id.trim()) throw new Error("Runtime product integration id must not be empty");
	integration = candidate;
	registered = true;
}

/** Lock and return the integration selected for this Runtime process. */
export function getRuntimeProductIntegration(): RuntimeProductIntegration {
	locked = true;
	return integration;
}

/** Test-only reset; production startup never calls this. */
export function resetRuntimeProductIntegrationForTests(): void {
	integration = nullRuntimeProductIntegration;
	registered = false;
	locked = false;
}
