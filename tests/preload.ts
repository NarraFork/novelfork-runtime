/**
 * Global test preload.
 *
 * Two responsibilities must happen in this order:
 *  1. Isolate every test process from the developer's real ~/.narrafork data.
 *  2. Keep the settings singleton valid when tests mutate its nested objects.
 *
 * Loaded via `bunfig.toml` → `[test].preload` before test modules are imported.
 */

import { afterAll, afterEach, beforeEach, mock } from "bun:test";
import * as fs from "node:fs";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";

if (process.platform === "win32" && process.env.NARRAFORK_DEFER_WINDOWS_TEMP_CLEANUP === "1") {
	const originalRmSync = fs.rmSync;
	mock.module("node:fs", () => ({
		...fs,
		default: fs,
		rmSync(path: fs.PathLike, options?: fs.RmDirOptions) {
			try {
				return originalRmSync(path, options);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === "EBUSY") return;
				throw error;
			}
		},
	}));
}

import { homedir, tmpdir } from "node:os";
import { resolve } from "node:path";

function normalizedPath(path: string): string {
	const resolved = resolve(path);
	return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function canonicalPath(path: string): string {
	try {
		return normalizedPath(realpathSync(path));
	} catch {
		return normalizedPath(path);
	}
}

const originalHome = process.env.NARRAFORK_TEST_REAL_HOME?.trim() || homedir();
process.env.NARRAFORK_TEST_REAL_HOME = originalHome;

const realNarraforkHome = canonicalPath(resolve(originalHome, ".narrafork"));
const requestedNarraforkHome = process.env.NARRAFORK_HOME?.trim();
const allowExplicitTestHome = process.env.NARRAFORK_ALLOW_MULTIPLE === "1";
const requestedCanonicalHome = requestedNarraforkHome
	? canonicalPath(requestedNarraforkHome)
	: undefined;

if (requestedCanonicalHome && requestedCanonicalHome === realNarraforkHome) {
	throw new Error(
		`Refusing to run tests against the real NarraFork data directory: ${realNarraforkHome}`,
	);
}
if (requestedNarraforkHome && !allowExplicitTestHome) {
	throw new Error(
		"NARRAFORK_HOME is only accepted by tests with NARRAFORK_ALLOW_MULTIPLE=1 and an isolated path",
	);
}

// Keep HOME isolated for child processes and code that consults the environment.
// Core NarraFork paths use NARRAFORK_HOME explicitly because Bun's os.homedir()
// is resolved from the host account rather than being changed at runtime.
const isolatedHome = mkdtempSync(resolve(tmpdir(), "narrafork-test-"));
const isolatedNarraforkHome = requestedNarraforkHome
	? resolve(requestedNarraforkHome)
	: resolve(isolatedHome, ".narrafork");

// Keep the original home dir reachable for code that must distinguish the real
// user home from the isolated test home. `os.homedir()` follows HOME/USERPROFILE
// on Bun (as on Node), so after the overrides below it no longer resolves to the
// host account — server/db/connection.ts consults this backup to refuse opening
// the real database from a test process.
process.env.NARRAFORK_ORIGINAL_HOME = originalHome;
process.env.HOME = isolatedHome;
process.env.USERPROFILE = isolatedHome;
process.env.NARRAFORK_HOME = isolatedNarraforkHome;
// A developer running NovelFork has NOVELFORK_HOME pointing at real product data, and its
// presence switches skill scanning into product mode. Tests opt into it explicitly.
delete process.env.NOVELFORK_HOME;
process.env.NARRAFORK_TEST = "1";

export const testEnvironment = Object.freeze({
	originalHome,
	realNarraforkHome,
	isolatedHome,
	narraforkHome: isolatedNarraforkHome,
});

// This import must remain dynamic and below the environment setup. A static import
// is evaluated before this module body and would load the real settings first.
const { getDefaults, settings } = await import("@server/lib/settings");

// Capture the isolated live settings at preload time. This is the authoritative
// state that other modules (e.g. auth.ts) will read from.
const snapshot = structuredClone(settings);

beforeEach(() => {
	// Restore any sub-objects that may have been wiped by a previous test.
	const defaults = getDefaults();
	for (const key of Object.keys(defaults) as Array<keyof typeof defaults>) {
		if (settings[key] === undefined || settings[key] === null) {
			// Use snapshot value (preserves runtime-generated secrets like jwtSecret)
			// biome-ignore lint/suspicious/noExplicitAny: restoring dynamic settings keys
			(settings as any)[key] = structuredClone((snapshot as any)[key]);
		}
	}
});

afterEach(() => {
	// Full restore from the original snapshot taken at module load time.
	for (const key of Object.keys(snapshot) as Array<keyof typeof snapshot>) {
		// biome-ignore lint/suspicious/noExplicitAny: restoring dynamic settings keys
		(settings as any)[key] = structuredClone((snapshot as any)[key]);
	}
});

afterAll(() => {
	// The temporary HOME is always owned by this preload, even when an explicit
	// isolated NARRAFORK_HOME was supplied for a database-heavy test.
	// On Windows an open bun:sqlite handle can still hold the directory at this
	// point (EBUSY); the OS temp dir reclaims it later, so a failed sweep is only
	// a warning, never a test failure.
	try {
		rmSync(isolatedHome, { recursive: true, force: true, maxRetries: 2 });
	} catch (error) {
		if (process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EBUSY") {
			return;
		}
		console.warn(`Failed to clean isolated test home: ${String(error)}`);
	}
});
