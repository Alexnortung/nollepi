import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTaskOrchestratorResult } from "../../extensions/workflows/task-orchestrator/result-parser.ts";

describe("parseTaskOrchestratorResult", () => {
	it("parses display text and continue payload", () => {
		const text = [
			"I want one more detail before we proceed.",
			"",
			"TASK_ORCHESTRATOR_JSON:",
			'{"status":"continue","summary":"Asked for one more detail."}',
		].join("\n");
		const parsed = parseTaskOrchestratorResult(text);
		assert.equal(parsed.displayText, "I want one more detail before we proceed.");
		assert.equal(parsed.result.status, "continue");
	});

	it("parses handoff payload", () => {
		const text = [
			"Great — we can move into execution.",
			"",
			"TASK_ORCHESTRATOR_JSON:",
			'{"status":"handoff","summary":"The human confirmed task alignment.","requestedTransition":"task-execution"}',
		].join("\n");
		const parsed = parseTaskOrchestratorResult(text);
		assert.equal(parsed.result.status, "handoff");
		assert.equal(parsed.result.requestedTransition, "task-execution");
	});

	it("parses dispatch requests", () => {
		const text = [
			"I am dispatching an investigator.",
			"",
			"TASK_ORCHESTRATOR_JSON:",
			'{"status":"continue","summary":"Dispatching investigator.","dispatchRequests":[{"role":"investigator","goal":"Inspect files","successTarget":"Return files"},{"role":"builder","goal":"Implement change","successTarget":"Write code","doneCriteria":["tests pass"]}]}',
		].join("\n");
		const parsed = parseTaskOrchestratorResult(text);
		assert.equal(parsed.result.dispatchRequests?.length, 2);
		assert.equal(parsed.result.dispatchRequests?.[0].role, "investigator");
		assert.equal(parsed.result.dispatchRequests?.[1].role, "builder");
	});

	it("throws when payload is missing", () => {
		assert.throws(() => parseTaskOrchestratorResult("plain text only"), /TASK_ORCHESTRATOR_JSON/);
	});
});
