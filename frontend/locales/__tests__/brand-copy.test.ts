/**
 * Author-visible copy must name the instance through `{{brand}}`, not a hard-coded
 * "NarraFork".
 *
 * A product that embeds the Runtime renames the instance (header, tab title,
 * `{{brand}}`), and any literal left in the bundles shows the upstream name next to
 * the product's own. `{{brand}}` resolves to the instance brand through the i18next
 * `defaultVariables` installed in `lib/i18n.ts`, so an upstream build still reads
 * "NarraFork"-free copy exactly as the configured brand.
 *
 * The allow-list holds protocol/product identifiers that are NOT the instance name:
 * the User-Agent option, the NarraFork Unified Gateway, the OAuth provider identity
 * and its manifest format, and `nav.appName` (overridden by branding at runtime).
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SUPPORTED_LOCALES } from "@shared/i18n-locales";

const LOCALES_DIR = join(import.meta.dir, "..");

/** `namespace:key` entries allowed to keep the literal. */
const ALLOWED = new Set([
	"nav:appName",
	"settings:customApiUserAgentNarrafork",
	"settings:fingerprintUserAgentDesc",
	"settings:fingerprintUaNarrafork",
	"settings:addProviderNugDesc",
]);
/** OAuth-provider admin copy: NarraFork there is the protocol identity, not the instance. */
const ALLOWED_PREFIXES = ["settings:oauthApps"];

function isAllowed(id: string): boolean {
	return ALLOWED.has(id) || ALLOWED_PREFIXES.some((prefix) => id.startsWith(prefix));
}

function flatten(value: unknown, prefix: string, out: Map<string, string>): void {
	if (typeof value === "string") {
		out.set(prefix, value);
		return;
	}
	if (value && typeof value === "object") {
		for (const [key, child] of Object.entries(value)) {
			flatten(child, prefix ? `${prefix}.${key}` : key, out);
		}
	}
}

describe.each([...SUPPORTED_LOCALES])("brand copy (%s)", (locale) => {
	test("no author-visible string hard-codes NarraFork", () => {
		const offenders: string[] = [];
		const dir = join(LOCALES_DIR, locale);
		for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
			const namespace = file.replace(/\.json$/, "");
			const entries = new Map<string, string>();
			flatten(JSON.parse(readFileSync(join(dir, file), "utf8")), "", entries);
			for (const [key, value] of entries) {
				const id = `${namespace}:${key}`;
				if (/NarraFork/.test(value) && !isAllowed(id)) offenders.push(id);
			}
		}
		expect(offenders).toEqual([]);
	});
});

describe("brand copy allow-list", () => {
	test("every allow-listed entry still exists and still needs the exemption", () => {
		// A stale exemption would silently allow a future regression under that key.
		for (const locale of SUPPORTED_LOCALES) {
			for (const id of ALLOWED) {
				const [namespace, key] = id.split(":");
				const entries = new Map<string, string>();
				flatten(
					JSON.parse(readFileSync(join(LOCALES_DIR, locale, `${namespace}.json`), "utf8")),
					"",
					entries,
				);
				expect(entries.get(key), `${locale}/${id}`).toContain("NarraFork");
			}
		}
	});
});
