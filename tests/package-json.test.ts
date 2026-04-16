import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
	pi?: { extensions?: unknown; skills?: unknown };
};

test("package manifest points pi at concrete extension package directories and vendored packages", () => {
	assert.deepEqual(pkg.pi?.extensions, [
		"./extensions/guards",
		"./extensions/pi-usage-extension",
		"./extensions/workflows",
	]);
});

test("package manifest exposes the repository skills directory", () => {
	assert.deepEqual(pkg.pi?.skills, ["./skills"]);
});
