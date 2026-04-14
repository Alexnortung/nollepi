import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
	pi?: { extensions?: unknown };
};

test("package manifest points pi at concrete extension entry files and vendored packages", () => {
	assert.deepEqual(pkg.pi?.extensions, [
		"./extensions/path-guard.ts",
		"./extensions/bash-command-guard.ts",
		"./extensions/pi-usage-extension",
	]);
});
