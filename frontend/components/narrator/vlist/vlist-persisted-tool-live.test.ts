import { describe, expect, it } from "bun:test";
import type { TreeMessage } from "@frontend/lib/api";
import { messageBody, rowWithElements } from "@shared/narrator-blocks/message-blocks";
import { classifyToolDetail } from "@shared/pretext-layout/tool-detail";
import { getSummary } from "../tool-call/tool-display";
import type { PersistedToolLiveUpdate } from "./useVListStreamingMessage";
import { toolCompletedPatch } from "./vlist-live-events";
import { patchToolLiveOutput } from "./vlist-live-patch";
import { PersistedToolLiveCoalescer } from "./vlist-persisted-tool-live";

function productToolDoc(status = "running"): TreeMessage[] {
	const input = { action: "start", sourceName: "参考书.txt" };
	return [
		rowWithElements(
			{
				id: "m1",
				narratorId: "n1",
				parentToolUseId: null,
				role: "assistant",
				contentText: null,
				toolCalls: [
					{
						id: "tc-1",
						narratorId: "n1",
						messageId: "m1",
						toolUseId: "tu-1",
						toolName: "style_manage",
						inputJson: input,
						status,
						createdAt: "2026-01-01T00:00:00.000Z",
					},
				],
				createdAt: "2026-01-01T00:00:00.000Z",
			},
			[{ type: "tool_use", id: "tu-1", name: "style_manage", input, inputJson: input, status }],
		) as unknown as TreeMessage,
	];
}

function liveFields(messages: readonly TreeMessage[]) {
	const tc = messages[0]?.toolCalls?.[0] as unknown as Record<string, unknown> | undefined;
	const blocks = messageBody(messages[0] as never) as readonly Record<string, unknown>[];
	const block = blocks.find((b) => b.type === "tool_use");
	return { tc, block };
}

describe("patchToolLiveOutput", () => {
	it("writes the live body onto a running committed card (row + block)", () => {
		const result = patchToolLiveOutput(productToolDoc(), "tu-1", {
			output: "[1/3] 正在调用模型…",
			progress: { completed: 0, total: 3 },
		});
		expect(result.changed).toBe(true);
		const { tc, block } = liveFields(result.messages);
		expect(tc?._streamingOutput).toBe("[1/3] 正在调用模型…");
		expect(block?._streamingOutput).toBe("[1/3] 正在调用模型…");
		expect(tc?._structuredProgress).toEqual({ completed: 0, total: 3 });
	});

	it("refuses a late frame once the card is terminal", () => {
		const doc = productToolDoc("success");
		const result = patchToolLiveOutput(doc, "tu-1", { output: "late" });
		expect(result.changed).toBe(false);
		expect(result.messages).toBe(doc);
	});

	it("refuses an unknown tool and an empty update", () => {
		const doc = productToolDoc();
		expect(patchToolLiveOutput(doc, "tu-x", { output: "x" }).changed).toBe(false);
		expect(patchToolLiveOutput(doc, "tu-1", {}).changed).toBe(false);
	});

	it("completion clears the live body so the card matches a reload", () => {
		const live = patchToolLiveOutput(productToolDoc(), "tu-1", {
			output: "running…",
			progress: { completed: 1, total: 3 },
		}).messages;
		const done = toolCompletedPatch({ toolUseId: "tu-1", status: "success", output: "{}" })(live);
		const { tc } = liveFields(done.messages);
		expect(tc?.status).toBe("success");
		expect(tc?._streamingOutput).toBeUndefined();
		expect(tc?._structuredProgress).toBeUndefined();
	});
});

describe("generic tool detail while running", () => {
	it("shows the live output and a count-based bar, and drops the bar when terminal", () => {
		const metadata = {
			_streamingOutput: "[2/3] 正在调用模型分析 batch-2…",
			_structuredProgress: { completed: 1, total: 3, currentItem: "batch-2" },
		};
		const running = classifyToolDetail({
			toolName: "style_manage",
			category: "generic",
			status: "running",
			inputJson: { action: "start" },
			outputJson: null,
			metadata,
		} as never);
		const keys = running?.kind === "sections" ? running.sections.map((s) => s.key) : [];
		expect(keys).toEqual(["meta.progress", "input.arguments", "output.main"]);
		const done = classifyToolDetail({
			toolName: "style_manage",
			category: "generic",
			status: "success",
			inputJson: { action: "start" },
			outputJson: "{}",
			metadata,
		} as never);
		const doneKeys = done?.kind === "sections" ? done.sections.map((s) => s.key) : [];
		expect(doneKeys).not.toContain("meta.progress");
	});

	it("the header summary never repeats the tool name", () => {
		expect(getSummary("style_manage", { action: "start", sourceName: "参考书.txt" })).toBe(
			"start · 参考书.txt",
		);
		expect(getSummary("book_overview", {})).toBe("");
	});
});

describe("PersistedToolLiveCoalescer", () => {
	function harness() {
		let now = 0;
		const applied: PersistedToolLiveUpdate[] = [];
		const timers: { at: number; fn: () => void; live: boolean }[] = [];
		const coalescer = new PersistedToolLiveCoalescer(
			{
				apply: (update) => applied.push(update),
				now: () => now,
				setTimer: (fn, ms) => {
					const timer = { at: now + ms, fn, live: true };
					timers.push(timer);
					return timer as never;
				},
				clearTimer: (handle) => {
					(handle as unknown as { live: boolean }).live = false;
				},
			},
			400,
		);
		const advance = (ms: number) => {
			now += ms;
			for (const timer of timers) {
				if (timer.live && timer.at <= now) {
					timer.live = false;
					timer.fn();
				}
			}
		};
		return { coalescer, applied, advance };
	}

	it("applies the first frame at once and coalesces the burst into one trailing patch", () => {
		const { coalescer, applied, advance } = harness();
		coalescer.push({ toolUseId: "t", output: "a" });
		expect(applied).toEqual([{ toolUseId: "t", output: "a" }]);
		coalescer.push({ toolUseId: "t", output: "a\nb" });
		coalescer.push({ toolUseId: "t", progress: { completed: 1, total: 2 } });
		coalescer.push({ toolUseId: "t", output: "a\nb\nc" });
		expect(applied).toHaveLength(1);
		advance(400);
		expect(applied[1]).toEqual({
			toolUseId: "t",
			output: "a\nb\nc",
			progress: { completed: 1, total: 2 },
		});
	});

	it("dispose drops pending frames", () => {
		const { coalescer, applied, advance } = harness();
		coalescer.push({ toolUseId: "t", output: "a" });
		coalescer.push({ toolUseId: "t", output: "b" });
		coalescer.dispose();
		advance(1000);
		expect(applied).toHaveLength(1);
	});
});
