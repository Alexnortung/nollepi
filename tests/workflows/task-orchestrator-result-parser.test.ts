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

	it("throws when payload is missing", () => {
		assert.throws(() => parseTaskOrchestratorResult("plain text only"), /TASK_ORCHESTRATOR_JSON/);
	});
});
