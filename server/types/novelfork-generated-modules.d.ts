// Generic declarations for Runtime release artifacts generated outside the
// replaceable upstream Runtime source tree. Implementations are emitted into
// server/generated/ by the product release compiler.
//
// Upstream v0.5.18 ships server/types/generated-modules.d.ts covering
// embedded-changelog and parcel-native-loader. This overlay file only declares
// what upstream leaves out, and uses a distinct filename so replacing the
// upstream tree never clobbers or duplicates the upstream declarations.
//
// embedded-migrations-data is required because the run-migrations overlay
// converts upstream's dynamic string import into a static @server alias import,
// which TypeScript can only resolve through an ambient module declaration.

declare module "@server/generated/embedded-migrations-data" {
	export const embeddedMigrationJournalJson: string;
	export const embeddedMigrationSqlFiles: readonly {
		readonly name: string;
		readonly content: string;
	}[];
}

declare module "@server/generated/embedded-frontend" {
	export const embeddedAssets: Record<string, string>;
}

// embedded-licenses is emitted by scripts/build-cross-platform.ts (step 5c)
// into server/generated/ for compiled binaries only. A dev tree has
// node_modules on disk and server/lib/licenses/manifest.ts scans it instead,
// so a fresh sync only ever needs the ambient declaration for typecheck.
declare module "@server/generated/embedded-licenses" {
	import type { LicenseEntry, LicenseProblem } from "@server/lib/licenses/types";
	export const embeddedLicenseEntries: readonly LicenseEntry[];
	export const embeddedLicenseTexts: Record<string, string>;
	export const embeddedLicenseProblems: readonly LicenseProblem[];
	export const embeddedLicenseGeneratedAt: number;
}
