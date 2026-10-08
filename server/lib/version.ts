import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const PRODUCT_NAME = "NovelFork";

let version = "0.0.0";
let commitHash = "";
let platform = "";
let productName = PRODUCT_NAME;

// Dev mode: expose the public NovelFork version. The private Runtime package
// keeps its implementation version separately and must not leak as product metadata.
const productPkgPath = resolve(import.meta.dir, "../../../../package.json");
if (existsSync(productPkgPath)) {
	const pkg = JSON.parse(readFileSync(productPkgPath, "utf-8"));
	version = pkg.version ?? "0.0.0";

	try {
		commitHash = execSync("git rev-parse --short HEAD", {
			encoding: "utf-8",
			timeout: 5000,
		}).trim();
	} catch {
		// git not available
	}
} else {
	// Compiled binary: no package.json, use generated build info
	try {
		const mod = (await import("@server/generated/build-info")) as {
			buildProduct?: string;
			buildVersion: string;
			buildCommit: string;
			buildPlatform?: string;
		};
		productName = mod.buildProduct ?? PRODUCT_NAME;
		version = mod.buildVersion;
		commitHash = mod.buildCommit;
		platform = mod.buildPlatform ?? "";
	} catch {
		// no build info either
	}
}

export const APP_VERSION: string = version;
export const GIT_COMMIT: string = commitHash;
/** Public product label from generated build metadata. */
export const BUILD_PRODUCT: string = productName;
/** Build platform identifier, e.g. "win-x64-baseline", "linux-x64". Empty in dev mode. */
export const BUILD_PLATFORM: string = platform;
