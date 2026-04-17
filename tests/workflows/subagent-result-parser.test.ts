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

	it("parses fenced RESULT_JSON blocks without a colon", () => {
		const text = [
			"Analysis:",
			"- looks good",
			"",
			"RESULT_JSON",
			"```json",
			'{"role":"builder","summary":"Implemented change","changedFiles":["x.ts"],"commits":[],"verification":[],"blockers":[]}',
			"```",
		].join("\n");
		const result = parseSubagentResult(text);
		assert.equal(result.role, "builder");
		assert.equal(result.summary, "Implemented change");
	});

	it("parses RESULT_JSON blocks even if trailing prose follows", () => {
		const text = `Analysis complete.\n\nRESULT_JSON:\n{"role":"reviewer","verdict":"pass","issues":[],"verificationGaps":[],"suggestedNextAction":"Ship it"}\n\nDone.`;
		const result = parseSubagentResult(text);
		assert.equal(result.role, "reviewer");
		assert.equal(result.verdict, "pass");
	});

	it("uses the final RESULT_JSON header instead of marker text inside JSON strings", () => {
		const text = [
			"Analysis:",
			"RESULT_JSON:",
			'{"role":"reviewer","verdict":"pass","issues":[],"verificationGaps":[],"suggestedNextAction":"Mention RESULT_JSON in the follow-up note"}',
		].join("\n");
		const result = parseSubagentResult(text);
		assert.equal(result.role, "reviewer");
		assert.equal(result.verdict, "pass");
	});

	it("throws when RESULT_JSON block is missing", () => {
		assert.throws(() => parseSubagentResult("just prose"), /RESULT_JSON/);
	});

	it("mentions the missing top-level role when the payload is malformed", () => {
		const text = `RESULT_JSON:\n{"verdict":"pass","issues":[],"verificationGaps":[],"suggestedNextAction":"Ship it"}`;
		assert.throws(() => parseSubagentResult(text), /role/i);
	});
});
