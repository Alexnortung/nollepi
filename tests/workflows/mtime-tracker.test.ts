import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { MtimeTracker } from "../../extensions/workflows/artifacts/mtime-tracker.ts";

describe("MtimeTracker", () => {
	it("detects no changes when no files are tracked", async () => {
		const tracker = new MtimeTracker();
		const changed = await tracker.checkForChanges();
		assert.deepEqual(changed, []);
	});

	it("detects no changes when files have not changed", async () => {
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mtime-test-"));
		const filePath = path.join(tmpDir, "test.md");
		await fs.writeFile(filePath, "hello");

		const tracker = new MtimeTracker();
		await tracker.recordMtime(filePath);
		const changed = await tracker.checkForChanges();
		assert.deepEqual(changed, []);

		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	it("detects changes when file is modified", async () => {
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mtime-test-"));
		const filePath = path.join(tmpDir, "test.md");
		await fs.writeFile(filePath, "hello");

		const tracker = new MtimeTracker();
		await tracker.recordMtime(filePath);
		await new Promise((resolve) => setTimeout(resolve, 50));
		await fs.writeFile(filePath, "world");

		const changed = await tracker.checkForChanges();
		assert.equal(changed.length, 1);
		assert.equal(changed[0], filePath);

		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	it("serializes and restores from map", () => {
		const tracker = new MtimeTracker();
		tracker.restoreFromMap(new Map([["a.md", 12345]]));
		const map = tracker.toMap();
		assert.equal(map.get("a.md"), 12345);
	});
});
