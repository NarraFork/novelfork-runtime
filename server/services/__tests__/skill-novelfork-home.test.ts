/**
 * Inside the NovelFork product the global Skill scan must read the product's own data
 * directory and nothing that belongs to a standalone NarraFork install.
 *
 * The product entry sets `NOVELFORK_HOME` (default `~/.novelfork`, relocatable off the user
 * profile) and points `NARRAFORK_HOME` at `$NOVELFORK_HOME/.runtime`. Before this rule the
 * scanner kept reading the hardcoded `~/.novelfork/skills` — so relocating the data
 * directory hid every product-level skill — and the legacy `~/.narrafork/skills`, which on a
 * machine that also runs NarraFork is that host's skill library, listed as NovelFork skills.
 *
 * The preload isolates HOME (Bun's `os.homedir()` follows USERPROFILE/HOME), so writing
 * under `homedir()` stays inside a temp directory.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
	loadGlobalSkills,
	loadProjectSkills,
	loadSkillSummariesForContext,
} from "../skill-service";

const PRODUCT_SKILL = `novelfork-home-probe-${process.pid}`;
const LEGACY_SKILL = `narrafork-legacy-probe-${process.pid}`;

const cleanup: string[] = [];
let novelForkHome: string;
let originalNovelForkHome: string | undefined;
let originalNarraforkHome: string | undefined;

async function writeSkillUnder(baseDir: string, name: string): Promise<string> {
	const dir = join(baseDir, name);
	await mkdir(dir, { recursive: true });
	const file = join(dir, "SKILL.md");
	await writeFile(file, `---\nname: "${name}"\ndescription: "probe"\n---\n\nbody\n`);
	cleanup.push(dir);
	return file;
}

beforeEach(async () => {
	originalNovelForkHome = process.env.NOVELFORK_HOME;
	originalNarraforkHome = process.env.NARRAFORK_HOME;
	novelForkHome = await mkdtemp(join(tmpdir(), "skill-novelfork-home-"));
	cleanup.push(novelForkHome);
	// Mirror the product entry: the Runtime data directory lives inside the product one.
	process.env.NOVELFORK_HOME = novelForkHome;
	process.env.NARRAFORK_HOME = join(novelForkHome, ".runtime");
});

afterEach(async () => {
	if (originalNovelForkHome === undefined) delete process.env.NOVELFORK_HOME;
	else process.env.NOVELFORK_HOME = originalNovelForkHome;
	if (originalNarraforkHome === undefined) delete process.env.NARRAFORK_HOME;
	else process.env.NARRAFORK_HOME = originalNarraforkHome;
	// Sequential, newest first: skill dirs sit inside the temp home registered before them,
	// and removing a parent concurrently with its child fails on Windows (EFAULT).
	for (const path of cleanup.splice(0).reverse()) {
		await rm(path, { recursive: true, force: true });
	}
});

describe("global skill scanning inside the NovelFork product", () => {
	it("discovers a skill written to $NOVELFORK_HOME/skills", async () => {
		const location = await writeSkillUnder(join(novelForkHome, "skills"), PRODUCT_SKILL);

		const found = (await loadGlobalSkills()).find((s) => s.name === PRODUCT_SKILL);
		expect(found?.location).toBe(location);
	});

	it("serves the same skill to the narrator's context-based lookup", async () => {
		await writeSkillUnder(join(novelForkHome, "skills"), PRODUCT_SKILL);

		const { skills } = await loadSkillSummariesForContext({}, { forceRefresh: true });
		expect(skills.some((s) => s.name === PRODUCT_SKILL)).toBe(true);
	});

	it("no longer reads ~/.novelfork/skills once NOVELFORK_HOME relocates it", async () => {
		await writeSkillUnder(join(homedir(), ".novelfork", "skills"), PRODUCT_SKILL);

		expect((await loadGlobalSkills()).some((s) => s.name === PRODUCT_SKILL)).toBe(false);
	});

	it("ignores a standalone NarraFork install's ~/.narrafork skill directories", async () => {
		await writeSkillUnder(join(homedir(), ".narrafork", "skills"), LEGACY_SKILL);
		await writeSkillUnder(join(homedir(), ".narrafork", "skill"), `${LEGACY_SKILL}-singular`);

		const names = new Set((await loadGlobalSkills()).map((s) => s.name));
		expect(names.has(LEGACY_SKILL)).toBe(false);
		expect(names.has(`${LEGACY_SKILL}-singular`)).toBe(false);
		const { skills } = await loadSkillSummariesForContext({}, { forceRefresh: true });
		expect(skills.some((s) => s.name === LEGACY_SKILL)).toBe(false);
	});

	it("keeps Runtime-created global skills under $NARRAFORK_HOME/skills visible", async () => {
		const location = await writeSkillUnder(
			join(novelForkHome, ".runtime", "skills"),
			PRODUCT_SKILL,
		);

		const found = (await loadGlobalSkills()).find((s) => s.name === PRODUCT_SKILL);
		expect(found?.location).toBe(location);
	});

	it("does not scan $NOVELFORK_HOME/skills for a project root", async () => {
		await writeSkillUnder(join(novelForkHome, "skills"), PRODUCT_SKILL);
		const projectRoot = await mkdtemp(join(tmpdir(), "skill-nf-project-"));
		cleanup.push(projectRoot);

		expect((await loadProjectSkills(projectRoot)).some((s) => s.name === PRODUCT_SKILL)).toBe(
			false,
		);
	});
});

describe("global skill scanning without a hosting product", () => {
	it("keeps the legacy ~/.narrafork/skills location readable", async () => {
		delete process.env.NOVELFORK_HOME;
		const location = await writeSkillUnder(join(homedir(), ".narrafork", "skills"), LEGACY_SKILL);

		const found = (await loadGlobalSkills()).find((s) => s.name === LEGACY_SKILL);
		expect(found?.location).toBe(location);
	});
});
