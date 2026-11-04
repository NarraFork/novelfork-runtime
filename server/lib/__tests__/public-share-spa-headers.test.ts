import { describe, expect, test } from "bun:test";
import { spaIndexHeaders } from "../spa-base-href";

/** The header that makes a shipped instance refuse indexing, whatever robots.txt says. */
const NOINDEX = "noindex, nofollow, noarchive";

/**
 * `toMatchObject` rather than `toEqual` since the CSP header was added (T-11): these two
 * tests exist to pin the cache/referrer/robots policy, and every header they name is still
 * asserted exactly. A new header is precisely the change they should NOT veto — the policy
 * itself is asserted in `tests/frontend/spa-csp.test.ts`, which is the test that fails if
 * the CSP is ever dropped.
 */
describe("SPA document response headers", () => {
	test("refuses indexing on public shares, and drops caches and referrers", () => {
		for (const path of ["/shared/narrators", "/shared/narrators/a", "/shared/narrators/invalid/"]) {
			expect(spaIndexHeaders(path)).toMatchObject({
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "no-store",
				"Referrer-Policy": "no-referrer",
				"X-Robots-Tag": NOINDEX,
			});
		}
	});

	test("refuses indexing on app pages too", () => {
		// Not a duplicate of frontend/public/robots.txt: robots.txt is only fetched from
		// the origin root, so a prefixed deployment (and any URL indexed before the
		// policy existed) is covered by this header alone. See spaIndexHeaders.
		for (const path of ["/", "/login", "/narrators/a", "/shared/narrators-other"]) {
			expect(spaIndexHeaders(path)).toMatchObject({
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "no-cache",
				"X-Robots-Tag": NOINDEX,
			});
		}
	});
});
