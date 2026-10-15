/**
 * A denied tool call re-run from the UI, a subagent resume or a post-update recovery goes
 * through the same executor as the live loop. A default-off tool (Write here) must stay
 * refused there too unless the author loaded its routine; the live loop's toolFilter is
 * not the only gate.
 *
 * Bun's mock.module is process-wide and mock.restore() does not undo it. So the database
 * is swapped inside beforeAll, the code under test is loaded after the swap, and afterAll
 * re-points the real module. Loading at file top level would leak this suite's database
 * into every suite that runs later in the same process.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { EventEmitter } from "node:events";
import { cleanDb, getTestDb } from "../../../tests/setup";
import { narratorMessageRefs, narratorMessages, narrators, narratorToolCalls } from "../../db/schema";

const { db, sqlite } = getTestDb();

const ROOT = "default-off-rerun-root";

let session: typeof import("../narrator-session");
let state: typeof import("../narrator-session-state");
let executor: typeof import("../../lib/agent/tool-executor");
let narratorPersistence: (typeof import("../narrator-persistence"))["narratorPersistence"];
let prepareToolCallAttempt: (typeof import("../narrator-persistence"))["narratorPersistence"]["prepareToolCallAttempt"];
let realDbModule: Record<string, unknown>;

beforeAll(async () => {
	// Snapshot the real module before mocking, so afterAll can restore it.
	realDbModule = { ...(await import("../../db")) };
	mock.module("../../db", () => ({ ...realDbModule, db, sqlite }));
	session = await import("../narrator-session");
	state = await import("../narrator-session-state");
	executor = await import("../../lib/agent/tool-executor");
	({ narratorPersistence } = await import("../narrator-persistence"));
	prepareToolCallAttempt = narratorPersistence.prepareToolCallAttempt.bind(narratorPersistence);
});

function makeActive(): import("../narrator-session-state").ActiveNarrator {
	return {
		narratorId: ROOT,
		conversationId: "test-conversation",
		cwd: process.env.HOME as string,
		model: "test:model",
		provider: "test",
		systemPrompt: null,
		events: new EventEmitter(),
		alive: true,
		locale: "en",
		abortController: new AbortController(),
		_enabledOptionalTools: new Set(),
		_disabledTools: new Set(),
		_blockedSkills: { all: false, names: new Set() },
		_substatus: new Set(),
	} as unknown as import("../narrator-session-state").ActiveNarrator;
}

/** A denied Write call from the root narrator, ready to be re-run. */
function seedDeniedWrite(suffix: string) {
	const messageId = `write-message-${suffix}`;
	const toolCallId = `write-row-${suffix}`;
	const toolUseId = `write-use-${suffix}`;
	const now = new Date().toISOString();
	db.insert(narratorMessages)
		.values({
			id: messageId,
			narratorId: ROOT,
			role: "assistant",
			contentJson: [
				{ type: "tool_use", id: toolUseId, name: "Write", input: { file_path: "notes.md", content: "x" } },
			],
			createdAt: now,
		})
		.run();
	db.insert(narratorMessageRefs)
		.values({ id: `write-ref-${suffix}`, narratorId: ROOT, messageId, seq: 1 })
		.run();
	db.insert(narratorToolCalls)
		.values({
			id: toolCallId,
			narratorId: ROOT,
			messageId,
			toolUseId,
			toolName: "Write",
			inputJson: { file_path: "notes.md", content: "x" },
			executionIdentityVersion: 1,
			executionAttempt: 1,
			status: "fail",
			permissionDecidedBy: "user",
			createdAt: now,
		})
		.run();
	spyOn(narratorPersistence, "prepareToolCallAttempt").mockImplementation(async (...args) => {
		const result = await prepareToolCallAttempt(...args);
		state.activeNarrators.set(ROOT, makeActive());
		return result;
	});
	return { toolUseId };
}

beforeEach(() => {
	cleanDb(sqlite);
	const now = new Date().toISOString();
	db.insert(narrators)
		.values({
			id: ROOT,
			type: "primary",
			variant: "primary",
			status: "idle",
			cwd: process.env.HOME,
			createdAt: now,
			updatedAt: now,
		})
		.run();
});

afterEach(() => {
	state.activeNarrators.clear();
	mock.restore();
});

afterAll(() => {
	mock.module("../../db", () => realDbModule);
});

describe("default-off tools on the re-run path", () => {
	test("a re-run Write is refused when its routine is not loaded and the tool body never runs", async () => {
		const row = seedDeniedWrite("refused");
		// Spy on the real executor and record what it returns to the re-run path.
		const executed = spyOn(executor, "executeTool");
		await session.reExecuteDeniedToolCall(ROOT, row.toolUseId, "en", false, null, {
			autoContinue: false,
		});
		expect(executed).toHaveBeenCalled();
		const outcomes = (await Promise.all(executed.mock.results.map((r) => r.value))) as Array<
			{ isError?: boolean; output?: unknown } | undefined
		>;
		// The gate must have produced the refusal; a run that reached the tool body would
		// report success instead.
		expect(outcomes.some((o) => o?.isError === true && String(o.output).includes("not loaded"))).toBe(true);
	});
});
