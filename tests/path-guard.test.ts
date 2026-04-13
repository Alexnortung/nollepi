import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createJsonStore } from "../extensions/shared/json-store";
import { matchesAllowlist, normalizeAllowlist, savePathAllowlistEntry } from "../extensions/path-guard";

test("path allowlist still matches files and directories", () => {
	const allowlist = normalizeAllowlist({
		files: ["/tmp/a.txt"],
		directories: ["/tmp/projects"],
	});

	assert.equal(matchesAllowlist(allowlist, "/tmp/a.txt"), true);
	assert.equal(matchesAllowlist(allowlist, "/tmp/projects/demo/file.ts"), true);
	assert.equal(matchesAllowlist(allowlist, "/tmp/other/file.ts"), false);
});

test("reloading before saving preserves manual file edits", async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "path-guard-"));
	const file = path.join(dir, "allowlist.json");
	const store = createJsonStore<{ files: string[]; directories: string[] }>(file, {
		defaultValue: { files: [], directories: [] },
		merge(current, next) {
			return {
				files: [...new Set([...current.files, ...next.files])],
				directories: [...new Set([...current.directories, ...next.directories])],
			};
		},
	});

	await fs.writeFile(file, JSON.stringify({ files: ["/tmp/manual.txt"], directories: [] }), "utf8");
	await savePathAllowlistEntry(store, "file", "/tmp/new.txt");

	const final = JSON.parse(await fs.readFile(file, "utf8")) as { files: string[]; directories: string[] };
	assert.deepEqual(final, {
		files: ["/tmp/manual.txt", "/tmp/new.txt"],
		directories: [],
	});
});

test("reloading before saving preserves manual directory edits", async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "path-guard-"));
	const file = path.join(dir, "allowlist.json");
	const store = createJsonStore<{ files: string[]; directories: string[] }>(file, {
		defaultValue: { files: [], directories: [] },
		merge(current, next) {
			return {
				files: [...new Set([...current.files, ...next.files])],
				directories: [...new Set([...current.directories, ...next.directories])],
			};
		},
	});

	await fs.writeFile(file, JSON.stringify({ files: [], directories: ["/tmp/manual"] }), "utf8");
	await savePathAllowlistEntry(store, "directory", "/tmp/new/project/file.txt");

	const final = JSON.parse(await fs.readFile(file, "utf8")) as { files: string[]; directories: string[] };
	assert.deepEqual(final, {
		files: [],
		directories: ["/tmp/manual", "/tmp/new/project"],
	});
});
