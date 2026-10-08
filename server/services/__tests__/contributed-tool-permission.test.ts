import { afterEach, describe, expect, test } from "bun:test";
import { z } from "zod/v4";

import { toolRegistry } from "../../lib/agent/tool-registry";
import type { ContributedToolPermissionPolicy, ToolDefinition } from "../../lib/agent/types";
import { resolvePermissionDecision } from "../narrator-permission";

const registeredNames: string[] = [];

afterEach(() => {
	for (const name of registeredNames.splice(0)) toolRegistry.unregister(name);
});

function registerPolicyTool(name: string, policy?: ContributedToolPermissionPolicy): void {
	const definition: ToolDefinition = {
		name,
		description: name,
		parameters: z.object({ action: z.string().optional() }),
		execute: async () => ({ output: "ok" }),
		...(policy ? { metadata: { contributedPermission: policy } } : {}),
	};
	toolRegistry.register(definition);
	registeredNames.push(name);
}

function decide(
	toolName: string,
	permMode: string,
	input: Record<string, unknown> = {},
	planMode = false,
): "allow" | "deny" | "ask" | "fatal" {
	return resolvePermissionDecision({
		toolName,
		input,
		permMode,
		planMode,
		cwd: process.cwd(),
	});
}

describe("contributed tool permission policy", () => {
	test("allows contributed read tools in interactive, read-only, and plan sessions", () => {
		registerPolicyTool("TestContributedRead", {
			risk: "read",
			enabledForModes: ["ask", "edit", "allow", "read", "plan"],
			visibility: "author",
		});

		expect(decide("TestContributedRead", "default")).toBe("allow");
		expect(decide("TestContributedRead", "acceptEdits")).toBe("allow");
		expect(decide("TestContributedRead", "readOnly")).toBe("allow");
		expect(decide("TestContributedRead", "default", {}, true)).toBe("allow");
	});

	test("preserves confirmation for confirmed and destructive writes", () => {
		registerPolicyTool("TestContributedDraft", {
			risk: "draft-write",
			enabledForModes: ["ask", "edit", "allow"],
			visibility: "author",
		});
		registerPolicyTool("TestContributedConfirmed", {
			risk: "confirmed-write",
			enabledForModes: ["ask", "edit", "allow"],
			visibility: "author",
		});
		registerPolicyTool("TestContributedDestructive", {
			risk: "destructive",
			enabledForModes: ["ask", "edit", "allow"],
			visibility: "advanced",
		});

		expect(decide("TestContributedDraft", "default")).toBe("ask");
		expect(decide("TestContributedDraft", "acceptEdits")).toBe("allow");
		expect(decide("TestContributedDraft", "dontAsk")).toBe("deny");

		expect(decide("TestContributedConfirmed", "default")).toBe("ask");
		expect(decide("TestContributedConfirmed", "acceptEdits")).toBe("ask");
		expect(decide("TestContributedConfirmed", "readOnly")).toBe("deny");
		expect(decide("TestContributedConfirmed", "bypassPermissions")).toBe("allow");

		expect(decide("TestContributedDestructive", "default")).toBe("ask");
		expect(decide("TestContributedDestructive", "acceptEdits")).toBe("ask");
		expect(decide("TestContributedDestructive", "bypassPermissions")).toBe("allow");
		expect(decide("TestContributedDestructive", "readOnly")).toBe("deny");
	});

	test("uses dynamic action risk without lowering the static safety ceiling on errors", () => {
		registerPolicyTool("TestContributedDynamic", {
			risk: "confirmed-write",
			enabledForModes: ["ask", "edit", "allow", "read", "plan"],
			visibility: "author",
			resolveRisk: (input) => input?.action === "list" ? "read" : "destructive",
		});
		registerPolicyTool("TestContributedBrokenResolver", {
			risk: "read",
			enabledForModes: ["ask", "edit", "allow", "read", "plan"],
			visibility: "author",
			resolveRisk: () => {
				throw new Error("broken resolver");
			},
		});

		expect(decide("TestContributedDynamic", "readOnly", { action: "list" })).toBe("allow");
		expect(decide("TestContributedDynamic", "readOnly", { action: "delete" })).toBe("deny");
		expect(decide("TestContributedDynamic", "default", { action: "delete" })).toBe("ask");
		expect(decide("TestContributedBrokenResolver", "default")).toBe("ask");
	});

	test("leaves tools without contributed metadata on the native Runtime path", () => {
		registerPolicyTool("TestNativeFallback");
		expect(decide("TestNativeFallback", "default")).toBe("ask");
		expect(decide("TestNativeFallback", "readOnly")).toBe("deny");
	});
});
