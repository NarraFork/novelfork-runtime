import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { deepMerge, getDefaults } from "../settings/index";
import {
	createUpdateSourceSettingsSchema,
	normalizeUpdateSourceSettings,
	updateSourceSettingsSchema,
} from "../settings/update-source";

// The settings shape a v0.1.0 NovelFork user carries from the upstream defaults.
const shippedSettings = {
	source: "github",
	githubRepository: "NarraFork/NarraFork",
	serverUrl: "https://narrafork-update.b.domexie.cn",
	product: "narrafork",
	channel: "stable",
	checkIntervalMinutes: 60,
	autoDownload: false,
};
const product = { repository: "vivy1024/novelfork", product: "novelfork" };

function normalize(update: Record<string, unknown>, profile = product) {
	const raw = { update };
	return normalizeUpdateSourceSettings(deepMerge(getDefaults(), raw), raw, profile);
}

describe("product update settings migration", () => {
	test("rewrites the shipped upstream repository and product, then persists once", () => {
		const first = normalize(shippedSettings);
		expect(first.update).toMatchObject({
			source: "github",
			githubRepository: "vivy1024/novelfork",
			product: "novelfork",
			channel: "stable",
			checkIntervalMinutes: 60,
			autoDownload: false,
		});
		expect(first.needsSave).toBe(true);
		const second = normalize(first.update as Record<string, unknown>);
		expect(second.update).toEqual(first.update);
		expect(second.needsSave).toBe(false);
	});

	test("matches the official repository case-insensitively", () => {
		expect(
			normalize({ ...shippedSettings, githubRepository: "narrafork/narrafork" }).update
				.githubRepository,
		).toBe("vivy1024/novelfork");
	});

	test("a mirror source becomes GitHub; its server URL is retained but unused", () => {
		const result = normalize({
			...shippedSettings,
			source: "update-server",
			serverUrl: "https://updates.example.com",
			product: "private",
		});
		expect(result.update).toMatchObject({
			source: "github",
			githubRepository: "vivy1024/novelfork",
			product: "novelfork",
			serverUrl: "https://updates.example.com",
		});
		expect(result.needsSave).toBe(true);
	});

	test("missing or unsafe repositories fall back to the build repository", () => {
		expect(normalize({}).update.githubRepository).toBe("vivy1024/novelfork");
		expect(normalize({ githubRepository: "../x" }).update.githubRepository).toBe(
			"vivy1024/novelfork",
		);
	});

	test("an explicit non-upstream repository is kept", () => {
		const result = normalize({ ...shippedSettings, githubRepository: "Someone/NovelFork" });
		expect(result.update.githubRepository).toBe("Someone/NovelFork");
	});

	test("upstream and plain fork builds keep their existing behavior", () => {
		for (const profile of [
			{ repository: "NarraFork/NarraFork", product: null },
			{ repository: "Fork/Repo", product: null },
		]) {
			const result = normalize(
				{ ...shippedSettings, source: "update-server" },
				profile as unknown as typeof product,
			);
			expect(result.update).toMatchObject({
				source: "update-server",
				githubRepository: "NarraFork/NarraFork",
				product: "narrafork",
			});
			expect(result.needsSave).toBe(false);
		}
	});
});

describe("product update settings schema", () => {
	const schema = createUpdateSourceSettingsSchema(product);
	test("rejects the mirror source", () => {
		expect(schema.safeParse({ source: "update-server" }).success).toBe(false);
		expect(schema.safeParse({ source: "github" }).success).toBe(true);
	});
	test("rejects pointing back at the upstream repository", () => {
		for (const githubRepository of ["NarraFork/NarraFork", "narrafork/NarraFork"])
			expect(schema.safeParse({ githubRepository }).success).toBe(false);
		expect(schema.safeParse({ githubRepository: "vivy1024/novelfork" }).success).toBe(true);
	});
	test("source builds keep accepting both sources", () => {
		expect(updateSourceSettingsSchema.safeParse({ source: "update-server" }).success).toBe(true);
		expect(
			createUpdateSourceSettingsSchema({ repository: "Fork/Repo", product: null }).safeParse({
				source: "update-server",
				githubRepository: "NarraFork/NarraFork",
			}).success,
		).toBe(true);
	});
});

describe("compile-time product profile", () => {
	const roots: string[] = [];
	afterEach(() => {
		for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
	});

	test("injected defines select the product profile, migration and mirror rejection", async () => {
		mkdirSync(join(process.cwd(), ".narrafork"), { recursive: true });
		const root = mkdtempSync(join(process.cwd(), ".narrafork/update-product-"));
		roots.push(root);
		const module = (path: string) => JSON.stringify(resolve(path));
		const fixture = join(root, "fixture.ts");
		writeFileSync(
			fixture,
			`import { BUILD_UPDATE_PROFILE, IS_PRODUCT_BUILD, releaseBinaryName } from ${module("shared/build-product.ts")};
import { DEFAULT_UPDATE_SETTINGS, normalizeUpdateSourceSettings, updateSourceSettingsSchema } from ${module("server/lib/settings/update-source.ts")};
const raw = { update: ${JSON.stringify(shippedSettings)} };
console.log(JSON.stringify({
	profile: BUILD_UPDATE_PROFILE,
	product: IS_PRODUCT_BUILD,
	name: releaseBinaryName("0.2.0", "windows-x64.exe"),
	defaults: DEFAULT_UPDATE_SETTINGS,
	migrated: normalizeUpdateSourceSettings({ update: { ...DEFAULT_UPDATE_SETTINGS, ...raw.update } }, raw),
	mirror: updateSourceSettingsSchema.safeParse({ source: "update-server" }).success,
	upstream: updateSourceSettingsSchema.safeParse({ githubRepository: "NarraFork/NarraFork" }).success,
	github: updateSourceSettingsSchema.safeParse({ source: "github" }).success,
}));`,
		);
		const result = await Bun.build({
			entrypoints: [fixture],
			outdir: join(root, "out"),
			target: "bun",
			throw: false,
			define: {
				__NARRAFORK_BUILD_REPOSITORY__: JSON.stringify("vivy1024/novelfork"),
				__NARRAFORK_BUILD_PRODUCT__: JSON.stringify("novelfork"),
				__NARRAFORK_RELEASE_ASSET_PREFIX__: JSON.stringify("novelfork-v"),
				__NARRAFORK_HELPER_REPOSITORY__: JSON.stringify("NarraFork/NarraFork"),
			},
		});
		expect(result.success).toBe(true);
		const output = JSON.parse(
			execFileSync(process.execPath, [join(root, "out", "fixture.js")], {
				cwd: root,
				encoding: "utf8",
				timeout: 30_000,
				maxBuffer: 1024 * 1024,
			}),
		);
		expect(output.profile).toEqual({
			repository: "vivy1024/novelfork",
			product: "novelfork",
			assetPrefix: "novelfork-v",
			helperRepository: "NarraFork/NarraFork",
		});
		expect(output.product).toBe(true);
		expect(output.name).toBe("novelfork-v0.2.0-windows-x64.exe");
		expect(output.defaults).toMatchObject({
			githubRepository: "vivy1024/novelfork",
			product: "novelfork",
		});
		expect(output.migrated.update).toMatchObject({
			source: "github",
			githubRepository: "vivy1024/novelfork",
			product: "novelfork",
		});
		expect(output.migrated.needsSave).toBe(true);
		expect(output.mirror).toBe(false);
		expect(output.upstream).toBe(false);
		expect(output.github).toBe(true);
	}, 60_000);
});
