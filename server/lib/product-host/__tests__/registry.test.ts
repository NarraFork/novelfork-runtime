import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { RuntimeProductIntegration } from "../contracts";
import { nullRuntimeProductIntegration } from "../null-integration";
import {
	getRuntimeProductIntegration,
	registerRuntimeProductIntegration,
	resetRuntimeProductIntegrationForTests,
} from "../registry";

const testIntegration: RuntimeProductIntegration = { id: "test.product" };

describe("Runtime product host registry", () => {
	beforeEach(resetRuntimeProductIntegrationForTests);
	afterEach(resetRuntimeProductIntegrationForTests);

	test("uses the null integration when no product entrypoint registers one", async () => {
		const integration = getRuntimeProductIntegration();

		expect(integration).toBe(nullRuntimeProductIntegration);
		expect(integration.narrator).toBeUndefined();
		expect(integration.mountAuthenticatedGuards).toBeUndefined();
		expect(integration.mountAuthenticatedRoutes).toBeUndefined();
		expect(integration.mountRuntimeBindingRoutes).toBeUndefined();
		expect(integration.learningContributions?.()).toEqual([]);
		expect(await integration.canAccessNarratorState?.({ narratorId: "narrator", userId: undefined })).toBe(
			true,
		);
	});

	test("accepts exactly one product registration before the Runtime graph is read", () => {
		registerRuntimeProductIntegration(testIntegration);

		expect(() => registerRuntimeProductIntegration({ id: "other.product" })).toThrow(
			"Runtime product integration is already registered: test.product",
		);
		expect(getRuntimeProductIntegration()).toBe(testIntegration);
	});

	test("rejects a product registration after the Runtime graph is locked", () => {
		getRuntimeProductIntegration();

		expect(() => registerRuntimeProductIntegration(testIntegration)).toThrow(
			"Runtime product integration must be registered before the Runtime is loaded",
		);
	});

	test("rejects an empty product integration id", () => {
		expect(() => registerRuntimeProductIntegration({ id: "  " })).toThrow(
			"Runtime product integration id must not be empty",
		);
	});
});
