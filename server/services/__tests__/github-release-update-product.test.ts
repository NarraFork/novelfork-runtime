import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { BUILD_UPDATE_PROFILE, releaseBinaryName } from "../../../shared/build-product";
import { CURRENT_RECOVERY_MANIFEST_VERSIONS } from "../../../shared/update-identity";
import { type GithubFetch, GithubReleaseUpdater } from "../github-release-update";

// An embedding product publishes `<prefix><version>-<suffix>` from its own repository.
const repository = "vivy1024/novelfork";
const productRelease = { assetPrefix: "novelfork-v", updateIndex: false };
const input = {
	repository,
	channel: "stable" as const,
	platform: "win-x64",
	currentVersion: "0.1.0",
};
const payload = Buffer.from("product executable");
const sha512 = createHash("sha512").update(payload).digest("base64");
const sha256 = createHash("sha256").update(payload).digest("hex");
const assetUrl = (version: string, name: string) =>
	`https://github.com/${repository}/releases/download/v${version}/${name}`;

function release(name: string, version = "0.2.0", prerelease = false) {
	const metadata = JSON.stringify({
		name,
		platform: "win-x64",
		target: "bun-windows-x64",
		version,
		commit: "0123abcd",
		repository,
		recoveryManifestVersions: [...CURRENT_RECOVERY_MANIFEST_VERSIONS],
		buildDate: "2026-11-22T00:00:00.000Z",
		size: payload.length,
		sha256,
		sha512,
	});
	return {
		metadata,
		release: {
			tag_name: `v${version}`,
			draft: false,
			prerelease,
			published_at: "2026-11-22T00:00:00Z",
			body: "notes",
			assets: [
				{
					name,
					size: payload.length,
					state: "uploaded",
					browser_download_url: assetUrl(version, name),
				},
				{
					name: `${name}.metadata.json`,
					size: Buffer.byteLength(metadata),
					state: "uploaded",
					browser_download_url: assetUrl(version, `${name}.metadata.json`),
				},
				{
					name: `${name}.sha256`,
					size: 90,
					state: "uploaded",
					browser_download_url: assetUrl(version, `${name}.sha256`),
				},
			],
		},
	};
}

function github(items: ReturnType<typeof release>[], options = productRelease) {
	const calls: string[] = [];
	const fetcher: GithubFetch = async (url) => {
		calls.push(url);
		if (url.startsWith("https://raw.githubusercontent.com/"))
			return new Response(null, { status: 404 });
		if (url.startsWith("https://api.github.com/"))
			return Response.json(items.map((item) => item.release));
		const selected = items.find((item) => item.release.assets[1]?.browser_download_url === url);
		if (!selected) throw new Error(`Unexpected fetch: ${url}`);
		return new Response(selected.metadata);
	};
	return { updater: new GithubReleaseUpdater(fetcher, Date.now, {}, options), calls };
}

describe("product release binary names", () => {
	test("source builds keep the upstream narrafork-<version>-<suffix> name", () => {
		expect(BUILD_UPDATE_PROFILE.assetPrefix).toBe("narrafork-");
		expect(BUILD_UPDATE_PROFILE.product).toBeNull();
		expect(releaseBinaryName("1.2.3", "linux-x64")).toBe("narrafork-1.2.3-linux-x64");
	});
	test("a product prefix may include the tag-style v", () => {
		expect(releaseBinaryName("0.2.0", "windows-x64.exe", "novelfork-v")).toBe(
			"novelfork-v0.2.0-windows-x64.exe",
		);
	});
});

describe("product GitHub update check", () => {
	test("matches the product-prefixed asset and its metadata sidecar via the releases API", async () => {
		const name = "novelfork-v0.2.0-windows-x64.exe";
		const { updater, calls } = github([release(name)]);
		const result = await updater.check(input);
		expect(result.errorCode).toBeUndefined();
		expect(result.updateAvailable).toBe(true);
		expect(result.latestVersion).toBe("0.2.0");
		expect(result.strategy).toBe("full");
		expect(result.releaseInfo?.path).toBe(name);
		expect(result.releaseInfo?.sha512).toBe(sha512);
		expect(result.releaseInfo?._github?.downloadUrl).toBe(assetUrl("0.2.0", name));
		expect(result.releaseInfo?.recoveryManifestVersions).toEqual([
			...CURRENT_RECOVERY_MANIFEST_VERSIONS,
		]);
		// No update-index branch is published; the raw catalog is never requested.
		expect(calls.some((url) => url.startsWith("https://raw.githubusercontent.com/"))).toBe(false);
		expect(calls[0]).toStartWith(`https://api.github.com/repos/${repository}/releases`);
	});

	test("ignores upstream-named assets, so a product never installs a NarraFork binary", async () => {
		const { updater } = github([release("narrafork-0.2.0-windows-x64.exe")]);
		const result = await updater.check(input);
		expect(result.updateAvailable).toBe(false);
		expect(result.errorCode).toBe("PLATFORM_UNAVAILABLE");
	});

	test("baseline platform picks only its own suffix", async () => {
		const normal = release("novelfork-v0.2.0-windows-x64.exe");
		const { updater } = github([normal]);
		const result = await updater.check({ ...input, platform: "win-x64-baseline" });
		expect(result.errorCode).toBe("PLATFORM_UNAVAILABLE");
	});

	test("stable channel skips prerelease product releases", async () => {
		const { updater } = github([
			release("novelfork-v0.3.0-windows-x64.exe", "0.3.0", true),
			release("novelfork-v0.2.0-windows-x64.exe"),
		]);
		const result = await updater.check(input);
		expect(result.latestVersion).toBe("0.2.0");
	});

	test("the current version reports no update", async () => {
		const { updater } = github([release("novelfork-v0.1.0-windows-x64.exe", "0.1.0")]);
		const result = await updater.check(input);
		expect(result.updateAvailable).toBe(false);
		expect(result.latestVersion).toBe("0.1.0");
		expect(result.errorCode).toBeUndefined();
	});

	test("a sidecar naming another binary is rejected", async () => {
		const item = release("novelfork-v0.2.0-windows-x64.exe");
		item.metadata = JSON.stringify({
			...JSON.parse(item.metadata),
			name: "narrafork-0.2.0-windows-x64.exe",
		});
		item.release.assets[1].size = Buffer.byteLength(item.metadata);
		const result = await github([item]).updater.check(input);
		expect(result.errorCode).toBe("INVALID_METADATA");
	});

	test("the default updater keeps upstream naming and ignores product assets", async () => {
		const { updater } = github([release("novelfork-v0.2.0-windows-x64.exe")], {
			assetPrefix: BUILD_UPDATE_PROFILE.assetPrefix,
			updateIndex: true,
		});
		const result = await updater.check(input);
		expect(result.errorCode).toBe("PLATFORM_UNAVAILABLE");
	});
});
