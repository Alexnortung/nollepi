import { strict as assert } from "node:assert";
import { test } from "node:test";
import { normalizeAllowlist, matchesAllowlist } from "../extensions/path-guard";

test("path allowlist still matches files and directories", () => {
	const allowlist = normalizeAllowlist({
		files: ["/tmp/a.txt"],
		directories: ["/tmp/projects"],
	});

	assert.equal(matchesAllowlist(allowlist, "/tmp/a.txt"), true);
	assert.equal(matchesAllowlist(allowlist, "/tmp/projects/demo/file.ts"), true);
	assert.equal(matchesAllowlist(allowlist, "/tmp/other/file.ts"), false);
});
