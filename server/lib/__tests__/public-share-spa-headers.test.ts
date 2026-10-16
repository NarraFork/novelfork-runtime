import { describe, expect, test } from "bun:test";
import { spaIndexHeaders } from "../spa-base-href";

/**
 * `toMatchObject` rather than `toEqual` since the CSP header was added (T-11): these two
 * tests exist to pin the cache/referrer/robots policy, and every header they name is still
 * asserted exactly. A new header is precisely the change they should NOT veto — the policy
 * itself is asserted in `tests/frontend/spa-csp.test.ts`, which is the test that fails if
 * the CSP is ever dropped.
 */
describe("public share SPA response headers", () => {
	test("prevents caches, referrers and indexing before React mounts", () => {
		for (const path of ["/shared/narrators", "/shared/narrators/a", "/shared/narrators/invalid/"]) {
			expect(spaIndexHeaders(path)).toMatchObject({
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "no-store",
				"Referrer-Policy": "no-referrer",
				"X-Robots-Tag": "noindex, nofollow, noarchive",
			});
		}
	});

	test("keeps the established policy for other pages", () => {
		for (const path of ["/", "/login", "/narrators/a", "/shared/narrators-other"]) {
			expect(spaIndexHeaders(path)).toMatchObject({
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "no-cache",
			});
		}
	});
});
