import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

describe("workflow_transition tool prompt", () => {
	it("describes review-owned commits without duplicate commits", () => {
		const filePath = path.resolve("extensions/workflows/tools/workflow-transition.ts");
		const source = fs.readFileSync(filePath, "utf8");
		assert.match(source, /existing commit hash/i);
		assert.match(source, /duplicate commit/i);
	});
});
