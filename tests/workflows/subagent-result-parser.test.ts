import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSubagentResult } from "../../extensions/workflows/subagents/result-parser.ts";

describe("parseSubagentResult", () => {
	it("parses RESULT_JSON investigator block", () => {
		const text = `Findings complete.\n\nRESULT_JSON:\n{"role":"investigator","findings":["A"],"relevantFiles":["x.ts"],"risks":["R"],"openQuestions":[],"suggestedNextAction":"Proceed"}`;
		const result = parseSubagentResult(text);
		assert.equal(result.role, "investigator");
		assert.deepEqual(result.findings, ["A"]);
	});

	it("throws when RESULT_JSON block is missing", () => {
		assert.throws(() => parseSubagentResult("just prose"), /RESULT_JSON/);
	});
});
