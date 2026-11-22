import { BUILD_GITHUB_REPOSITORY } from "./build-repository";
import { isValidGitHubRepository, OFFICIAL_GITHUB_REPOSITORY } from "./github-repository";

declare const __NARRAFORK_BUILD_PRODUCT__: string;
declare const __NARRAFORK_RELEASE_ASSET_PREFIX__: string;
declare const __NARRAFORK_HELPER_REPOSITORY__: string;

/**
 * Compile-time identity of an embedding product (for example a downstream single-file EXE that
 * ships its own GitHub releases). Never derived from runtime env, settings or the working tree.
 */
export interface UpdateBuildProfile {
	/** GitHub repository whose releases carry this program's main binary. */
	repository: string;
	/** Embedding product id; null for upstream NarraFork builds. */
	product: string | null;
	/** Release binary file name prefix before the version, e.g. "narrafork-" or "novelfork-v". */
	assetPrefix: string;
	/** GitHub repository that publishes rg/zstd/executor/RTC helper releases. */
	helperRepository: string;
}

const PRODUCT_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ASSET_PREFIX_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

// Compile-time constants only; `typeof` keeps undefined identifiers safe in source runs.
const product =
	typeof __NARRAFORK_BUILD_PRODUCT__ === "undefined" ? undefined : __NARRAFORK_BUILD_PRODUCT__;
const assetPrefix =
	typeof __NARRAFORK_RELEASE_ASSET_PREFIX__ === "undefined"
		? undefined
		: __NARRAFORK_RELEASE_ASSET_PREFIX__;
const helperRepository =
	typeof __NARRAFORK_HELPER_REPOSITORY__ === "undefined"
		? undefined
		: __NARRAFORK_HELPER_REPOSITORY__;
if (product !== undefined && (!PRODUCT_RE.test(product) || product === "narrafork"))
	throw new Error("Invalid compiled product id");
if (assetPrefix !== undefined && (!ASSET_PREFIX_RE.test(assetPrefix) || assetPrefix.includes("..")))
	throw new Error("Invalid compiled release asset prefix");
if (helperRepository !== undefined && !isValidGitHubRepository(helperRepository))
	throw new Error("Invalid compiled helper repository");

export const BUILD_UPDATE_PROFILE: Readonly<UpdateBuildProfile> = Object.freeze({
	repository: BUILD_GITHUB_REPOSITORY,
	product: product ?? null,
	assetPrefix: assetPrefix ?? "narrafork-",
	helperRepository: helperRepository ?? BUILD_GITHUB_REPOSITORY,
});

/** Embedding product builds update only from their own GitHub releases; no mirror source. */
export const IS_PRODUCT_BUILD = BUILD_UPDATE_PROFILE.product !== null;

/** Upstream releases are `narrafork-<version>-<suffix>`; products choose their own prefix. */
export function releaseBinaryName(
	version: string,
	suffix: string,
	prefix: string = BUILD_UPDATE_PROFILE.assetPrefix,
): string {
	return `${prefix}${version}-${suffix}`;
}

export function isOfficialGithubRepository(repository: string | undefined): boolean {
	return repository?.trim().toLowerCase() === OFFICIAL_GITHUB_REPOSITORY.toLowerCase();
}
