/**
 * spa-csp.test.ts — the SPA document must carry a CSP, and the policy must match the app.
 *
 * Why the hash assertion exists
 * ----------------------------
 * `frontend/index.html` boots the colour scheme and the cached instance brand from a single
 * inline `<script>`, before any bundle loads. A CSP with `script-src 'self'` alone would
 * block it: the page still renders (React mounts later and fixes the theme), so nothing
 * looks broken while every visitor gets a flash of the wrong theme plus a console violation.
 * Pinning the script by sha256 keeps the protection — no OTHER inline script runs — and
 * turns "somebody edited the boot script and forgot the header" into a failing test.
 *
 * The hash is recomputed from the file here, so this test cannot drift out of sync with the
 * header by hand: it is the header that must agree with the file.
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
	inlineScriptHashes,
	spaContentSecurityPolicy,
	spaIndexHeaders,
} from "@server/lib/spa-base-href";

const APP_SHELL = await Bun.file("frontend/index.html").text();

/** Directives as a lookup, so an assertion reads as "which sources are allowed where". */
function directivesOf(policy: string): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const part of policy.split(";")) {
		const [name, ...values] = part.trim().split(/\s+/);
		if (name) out[name] = values;
	}
	return out;
}

const policy = spaIndexHeaders("/")["Content-Security-Policy"]!;
const directives = directivesOf(policy);

describe("every SPA navigation carries the policy", () => {
	test("the header is present for public shares and for normal pages alike", () => {
		for (const path of ["/", "/login", "/narrators/a", "/shared/narrators", "/shared/narrators/a"]) {
			expect(spaIndexHeaders(path)["Content-Security-Policy"]).toBeString();
			expect(spaIndexHeaders(path)["Content-Security-Policy"]).toContain("default-src 'self'");
		}
	});

	test("the existing cache/privacy headers are unchanged", () => {
		expect(spaIndexHeaders("/shared/narrators/a")).toMatchObject({
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
			"Referrer-Policy": "no-referrer",
			"X-Robots-Tag": "noindex, nofollow, noarchive",
		});
		expect(spaIndexHeaders("/login")).toMatchObject({
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-cache",
		});
	});
});

describe("the policy matches what the app actually does", () => {
	test("locks down the defaults and the object/base/form surfaces", () => {
		expect(directives["default-src"]).toEqual(["'self'"]);
		expect(directives["object-src"]).toEqual(["'none'"]);
		expect(directives["base-uri"]).toEqual(["'self'"]);
		expect(directives["form-action"]).toEqual(["'self'"]);
		expect(directives["frame-ancestors"]).toEqual(["'self'"]);
	});

	test("does not hand out 'unsafe-eval' or a wildcard script source", () => {
		const scriptSrc = directives["script-src"] ?? [];
		// 'wasm-unsafe-eval' is a different token and is required for the Shiki engine;
		// plain 'unsafe-eval' would also allow eval()/new Function() and is NOT allowed.
		expect(scriptSrc).not.toContain("'unsafe-eval'");
		expect(scriptSrc).not.toContain("*");
		expect(scriptSrc).not.toContain("https:");
		expect(scriptSrc).not.toContain("http:");
	});

	test("allows the two capabilities the bundle genuinely needs", () => {
		// Shiki compiles an Emscripten module; Monaco builds its worker bootstrap as a blob.
		expect(directives["script-src"]).toContain("'wasm-unsafe-eval'");
		expect(directives["script-src"]).toContain("blob:");
		expect(directives["worker-src"]).toEqual(["'self'", "blob:"]);
	});

	test("keeps the same-origin connections the app opens", () => {
		const connectSrc = directives["connect-src"] ?? [];
		expect(connectSrc).toContain("'self'");
		expect(connectSrc).toContain("ws:");
		expect(connectSrc).toContain("wss:");
	});

	test("keeps inline styles (React style=, ghost-text, Mantine variables)", () => {
		const styleSrc = directives["style-src"] ?? [];
		expect(styleSrc).toContain("'self'");
		expect(styleSrc).toContain("'unsafe-inline'");
	});
});

describe("the inline boot script survives, and only because it is hashed", () => {
	test("the shell has exactly one inline script", () => {
		const inline = APP_SHELL.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g) ?? [];
		expect(inline).toHaveLength(1);
	});

	test("the hash is computed from the document, so a build rewrite cannot stale it", () => {
		const hashes = inlineScriptHashes(APP_SHELL);
		expect(hashes).toHaveLength(1);
		// The served policy must carry exactly this document's hashes — not a constant.
		const served = spaIndexHeaders("/", inlineScriptHashes(APP_SHELL))["Content-Security-Policy"]!;
		expect(directivesOf(served)["script-src"]).toContain(hashes[0]!);
		// A rewritten script (the build minifies the shell) changes the hash, and the
		// policy follows the document rather than failing to match it.
		const rewritten = APP_SHELL.replace("var d = localStorage.getItem", "var d=localStorage.getItem");
		expect(inlineScriptHashes(rewritten)[0]).not.toBe(hashes[0]);
	});

	test("the digest matches the sha256 of the script body", () => {
		const inline = APP_SHELL.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/);
		expect(inline).not.toBeNull();
		const digest = createHash("sha256")
			.update(Buffer.from(inline![1]!, "utf8"))
			.digest("base64");
		expect(inlineScriptHashes(APP_SHELL)).toEqual([`'sha256-${digest}'`]);
	});

	test("the policy without hashes still blocks every inline script", () => {
		// The default policy (no document in hand) keeps the strict form.
		expect(directivesOf(spaContentSecurityPolicy())["script-src"]).toEqual([
			"'self'",
			"'wasm-unsafe-eval'",
			"blob:",
		]);
	});

	test("the script still does the work the page depends on", () => {
		// If this ever moves into a bundle, the hash can go with it — but until then the
		// theme + brand mirror are the reason hashing exists at all.
		expect(APP_SHELL).toContain("mantine-color-scheme-value");
		expect(APP_SHELL).toContain("narrafork_brand_name");
	});
});
