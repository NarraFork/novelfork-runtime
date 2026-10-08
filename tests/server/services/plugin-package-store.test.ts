import { afterEach, describe, expect, test } from "bun:test";
import {
	cp,
	lstat,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";
import { PluginPackageStore } from "@server/services/plugin-package-store";

const fixturePackage = fileURLToPath(
	new URL("../../fixtures/plugins/packages/valid-package", import.meta.url),
);
const tempRoots: string[] = [];

async function makeTempRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "narrafork-plugin-store-"));
	tempRoots.push(root);
	return root;
}

async function copyFixture(root: string, name = "package"): Promise<string> {
	const destination = join(root, name);
	await cp(fixturePackage, destination, { recursive: true });
	return destination;
}

async function mutateManifest(
	packagePath: string,
	update: (manifest: Record<string, unknown>) => void,
): Promise<void> {
	const manifestPath = join(packagePath, "manifest.json");
	const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
	update(manifest);
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function makeZipSlipArchive(root: string): Promise<string> {
	// Build the zip-slip archive in-process instead of shelling out to the `zip` CLI, which is
	// not installed on Windows. The single stored entry keeps a leading `..` path so the store
	// must reject it as escaping its root before extraction. The store lists names with
	// `unzip -Z1` (present on Windows), which prints the crafted name verbatim, so the traversal
	// assertion is preserved on every platform without depending on a POSIX archiver.
	const archive = join(root, "escape.nfplugin");
	await writeFile(archive, buildStoredZip("../zip-source/evil/escape.txt", "escape"));
	return archive;
}

/** A minimal single-entry, stored (uncompressed) ZIP with an arbitrary, unsanitized name. */
function buildStoredZip(entryName: string, content: string): Uint8Array {
	const name = new TextEncoder().encode(entryName);
	const data = new TextEncoder().encode(content);
	const crc = crc32(data) >>> 0;
	const dosTime = 0;
	const dosDate = 0x21; // 1980-01-01; any valid DOS date satisfies zipinfo.

	const local = new Uint8Array(30 + name.byteLength + data.byteLength);
	const lv = new DataView(local.buffer);
	lv.setUint32(0, 0x04034b50, true); // local file header signature
	lv.setUint16(4, 20, true); // version needed to extract
	lv.setUint16(6, 0, true); // general purpose flags
	lv.setUint16(8, 0, true); // compression method: stored
	lv.setUint16(10, dosTime, true);
	lv.setUint16(12, dosDate, true);
	lv.setUint32(14, crc, true);
	lv.setUint32(18, data.byteLength, true); // compressed size
	lv.setUint32(22, data.byteLength, true); // uncompressed size
	lv.setUint16(26, name.byteLength, true);
	lv.setUint16(28, 0, true); // extra field length
	local.set(name, 30);
	local.set(data, 30 + name.byteLength);
	const central = new Uint8Array(46 + name.byteLength);
	const cv = new DataView(central.buffer);
	cv.setUint32(0, 0x02014b50, true); // central directory header signature
	cv.setUint16(4, 20, true); // version made by
	cv.setUint16(6, 20, true); // version needed to extract
	cv.setUint16(8, 0, true); // general purpose flags
	cv.setUint16(10, 0, true); // compression method: stored
	cv.setUint16(12, dosTime, true);
	cv.setUint16(14, dosDate, true);
	cv.setUint32(16, crc, true);
	cv.setUint32(20, data.byteLength, true); // compressed size
	cv.setUint32(24, data.byteLength, true); // uncompressed size
	cv.setUint16(28, name.byteLength, true);
	cv.setUint16(30, 0, true); // extra field length
	cv.setUint16(32, 0, true); // comment length
	cv.setUint16(34, 0, true); // disk number start
	cv.setUint16(36, 0, true); // internal attributes
	cv.setUint32(38, 0, true); // external attributes
	cv.setUint32(42, 0, true); // relative offset of local header
	central.set(name, 46);

	const eocd = new Uint8Array(22);
	const ev = new DataView(eocd.buffer);
	ev.setUint32(0, 0x06054b50, true); // end of central directory signature
	ev.setUint16(4, 0, true); // number of this disk
	ev.setUint16(6, 0, true); // disk with the start of the central directory
	ev.setUint16(8, 1, true); // entries on this disk
	ev.setUint16(10, 1, true); // total entries
	ev.setUint32(12, central.byteLength, true); // central directory size
	ev.setUint32(16, local.byteLength, true); // central directory offset
	ev.setUint16(20, 0, true); // comment length

	const out = new Uint8Array(local.byteLength + central.byteLength + eocd.byteLength);
	out.set(local, 0);
	out.set(central, local.byteLength);
	out.set(eocd, local.byteLength + central.byteLength);
	return out;
}

afterEach(async () => {
	for (const root of tempRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("PluginPackageStore", () => {
	test("installs a valid package into an immutable hash directory and updates current atomically", async () => {
		const root = await makeTempRoot();
		const store = new PluginPackageStore(root);
		const result = await store.install(fixturePackage);

		expect(result.pluginId).toBe("com.example.hello");
		expect(result.version).toBe("1.0.0");
		expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
		expect(result.packagePath).toBe(
			join(root, "packages", result.pluginId, result.version, result.hash),
		);
		expect(result.alreadyInstalled).toBe(false);
		expect((await store.readCurrent()).plugins[result.pluginId]).toEqual({
			version: result.version,
			hash: result.hash,
		});
		expect((await readdir(join(root, "staging"))).length).toBe(0);
	});

	test("rejects archive path traversal before extraction", async () => {
		const root = await makeTempRoot();
		const archiveRoot = await makeTempRoot();
		const archive = await makeZipSlipArchive(archiveRoot);
		const store = new PluginPackageStore(root);

		await expect(store.install(archive)).rejects.toThrow(/escapes|absolute|invalid/i);
		expect(await Bun.file(join(root, "current.json")).exists()).toBe(false);
		expect((await readdir(join(root, "staging"))).length).toBe(0);
	});

	test("rejects a source symlink that escapes the package root", async () => {
		if (process.platform === "win32") return;
		const root = await makeTempRoot();
		const sourceRoot = await copyFixture(root, "source");
		const outside = join(root, "outside.txt");
		await writeFile(outside, "outside");
		await symlink(outside, join(sourceRoot, "escape.txt"));

		await expect(new PluginPackageStore(root).install(sourceRoot)).rejects.toThrow(/symlink/i);
	});

	test("rejects unknown and malformed manifests without executing the entry", async () => {
		const root = await makeTempRoot();
		const unknown = await copyFixture(root, "unknown");
		await mutateManifest(unknown, (manifest) => {
			manifest.unknownField = "must be rejected";
		});
		await expect(new PluginPackageStore(root).install(unknown)).rejects.toThrow(/manifest/i);

		const malformed = await copyFixture(root, "malformed");
		await writeFile(join(malformed, "manifest.json"), "not json");
		await expect(new PluginPackageStore(root).install(malformed)).rejects.toThrow(/manifest/i);
	});

	test("deduplicates an identical hash without overwriting the existing package", async () => {
		const root = await makeTempRoot();
		const store = new PluginPackageStore(root);
		const first = await store.install(fixturePackage);
		const second = await store.install(fixturePackage);

		expect(second.hash).toBe(first.hash);
		expect(second.packagePath).toBe(first.packagePath);
		expect(second.alreadyInstalled).toBe(true);
		expect(
			(await readdir(join(root, "packages", first.pluginId, first.version))).filter(
				(name) => name === first.hash,
			),
		).toHaveLength(1);
	});

	test("keeps the old current pointer when an atomic current update fails", async () => {
		const root = await makeTempRoot();
		const firstStore = new PluginPackageStore(root);
		const first = await firstStore.install(fixturePackage);
		const nextPackage = await copyFixture(root, "next");
		await mutateManifest(nextPackage, (manifest) => {
			manifest.version = "1.0.1";
		});
		const failingStore = new PluginPackageStore({
			root,
			renameCurrent: async () => {
				throw new Error("simulated pointer failure");
			},
		});

		await expect(failingStore.install(nextPackage)).rejects.toThrow(/atomically update/i);
		expect((await firstStore.readCurrent()).plugins[first.pluginId]).toEqual({
			version: first.version,
			hash: first.hash,
		});
		expect((await lstat(first.packagePath)).isDirectory()).toBe(true);
	});

	test("serializes shared current updates, enforces CAS, and cleans stale staging", async () => {
		const root = await makeTempRoot();
		const first = new PluginPackageStore(root);
		const second = new PluginPackageStore(root);
		const pointerA = { version: "1.0.0", hash: "a".repeat(64) };
		const pointerB = { version: "2.0.0", hash: "b".repeat(64) };
		await Promise.all([
			first.setCurrent("com.example.a", pointerA, { expectedCurrent: null }),
			second.setCurrent("com.example.b", pointerB, { expectedCurrent: null }),
		]);
		expect((await first.readCurrent()).plugins).toEqual({
			"com.example.a": pointerA,
			"com.example.b": pointerB,
		});
		await expect(
			first.setCurrent("com.example.a", pointerB, {
				expectedCurrent: { version: "9.0.0", hash: "c".repeat(64) },
			}),
		).rejects.toThrow(/pointer changed/i);
		await mkdir(join(root, "staging", "stale"), { recursive: true });
		await writeFile(join(root, "staging", "stale", "leftover"), "stale");
		expect(await first.cleanupStaging()).toBe(1);
		expect(await Bun.file(join(root, "staging", "stale", "leftover")).exists()).toBe(false);
	});

	test("does not execute the server entry while installing", async () => {
		const root = await makeTempRoot();
		const result = await new PluginPackageStore(root).install(fixturePackage);
		expect(result.manifest.server?.entry).toBe("server/index.js");
	});
});
