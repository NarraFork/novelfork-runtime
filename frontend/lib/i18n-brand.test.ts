/**
 * `{{brand}}` must render the instance brand even where a caller passes no `brand`
 * option (error catalog, danger copy, plain modules), and must follow a rename
 * without a reload. Without the default, i18next prints `{{brand}}` literally.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { DEFAULT_BRAND_NAME } from "@shared/branding";
import { createInstance } from "i18next";
import { applyBranding } from "./branding";
import { installBrandDefaultVariable } from "./i18n";

afterEach(() => {
	applyBranding(undefined);
});

async function probeInstance() {
	const instance = createInstance();
	await instance.init({
		lng: "en",
		resources: { en: { translation: { probe: "hello {{brand}}", err: "{{name}} at {{brand}}" } } },
		interpolation: { escapeValue: false },
	});
	return instance;
}

describe("installBrandDefaultVariable", () => {
	test("fills {{brand}} without a caller-supplied option", async () => {
		applyBranding(undefined);
		const instance = await probeInstance();
		const stop = installBrandDefaultVariable(instance);
		try {
			expect(instance.t("probe")).toBe(`hello ${DEFAULT_BRAND_NAME}`);
			// The error-catalog path passes params through `replace`, never `brand`.
			expect(instance.t("err", { replace: { name: "x" } })).toBe(`x at ${DEFAULT_BRAND_NAME}`);
		} finally {
			stop();
		}
	});

	test("follows a branding change and yields to an explicit option", async () => {
		const instance = await probeInstance();
		const stop = installBrandDefaultVariable(instance);
		try {
			applyBranding({ name: "Studio" });
			expect(instance.t("probe")).toBe("hello Studio");
			expect(instance.t("probe", { brand: "Explicit" })).toBe("hello Explicit");
		} finally {
			stop();
		}
	});
});
