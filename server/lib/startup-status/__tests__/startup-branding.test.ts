import { describe, expect, test } from "bun:test";
import { startupPageHtml } from "../page";
import { brandStartupProblem, toStartupProblem } from "../startup-error";
import { InstanceLockedError } from "../startup-problems";

// NovelFork fork layer: the status page and startup problems speak with the instance's name.
describe("startup branding", () => {
	test("the page's own words use the brand, not NarraFork", () => {
		const html = startupPageHtml("NovelFork");
		expect(html).toContain("<title>NovelFork</title>");
		expect(html).toContain('const brand = "NovelFork";');
		const script = html.slice(html.indexOf("<script>"), html.indexOf("</script>"));
		const strings = script.match(/"[^"\n]*"/g) ?? [];
		expect(strings.filter((text) => text.includes("NarraFork"))).toEqual([]);
	});

	test("a brand cannot break out of the inline script", () => {
		const html = startupPageHtml('</script><script>alert(1)</script>"');
		const script = html.slice(html.indexOf("<script>") + "<script>".length);
		expect(script.indexOf("</script>")).toBe(script.lastIndexOf("</script>"));
		expect(html).toContain("\u003c/script\u003e");
	});

	test("problem messages carry the brand; command and detail stay as they are", () => {
		const problem = new InstanceLockedError(4242, "NarraFork pid 4242 holds the lock").problem;
		const branded = brandStartupProblem(problem, "NovelFork");
		expect(branded.message.zh).toBe(
			"另一个 NovelFork 正在使用这个数据目录。先停止它，再重新启动。",
		);
		expect(branded.message.en).toContain("Another NovelFork");
		expect(branded.command).toBe(problem.command);
		expect(branded.detail).toBe("NarraFork pid 4242 holds the lock");
	});

	test("an unexpected error is worded with the brand too", () => {
		const branded = brandStartupProblem(toStartupProblem(new Error("x")), "我的书房");
		expect(branded.message.zh).toBe("我的书房 启动时遇到意外错误。");
	});

	test("the upstream name or a blank brand leaves the problem untouched", () => {
		const problem = toStartupProblem(new Error("x"));
		expect(brandStartupProblem(problem, "NarraFork")).toBe(problem);
		expect(brandStartupProblem(problem, "  ")).toBe(problem);
	});
});
