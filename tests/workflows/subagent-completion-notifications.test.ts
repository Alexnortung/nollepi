import assert from "node:assert/strict";
import { test } from "node:test";
import { recordSubagentCompletionSummary } from "../../extensions/workflows/subagents/completion-notifications.ts";

test("recordSubagentCompletionSummary stores success summaries as non-context entries", () => {
	const calls: Array<{ customType: string; data: unknown }> = [];
	const pi = {
		appendEntry(customType: string, data: unknown) {
			calls.push({ customType, data });
		},
	};

	recordSubagentCompletionSummary(pi, { id: 7, role: "reviewer" });

	assert.equal(calls.length, 1);
	assert.deepEqual(calls[0], {
		customType: "workflow-subagent-summary",
		data: {
			runId: 7,
			role: "reviewer",
			summary: "reviewer #7 finished.",
		},
	});
});

test("recordSubagentCompletionSummary stores error summaries as non-context entries", () => {
	const calls: Array<{ customType: string; data: unknown }> = [];
	const pi = {
		appendEntry(customType: string, data: unknown) {
			calls.push({ customType, data });
		},
	};

	recordSubagentCompletionSummary(pi, { id: 8, role: "builder" }, "boom");

	assert.equal(calls.length, 1);
	assert.deepEqual(calls[0], {
		customType: "workflow-subagent-summary",
		data: {
			runId: 8,
			role: "builder",
			summary: "builder #8 failed: boom",
			error: "boom",
		},
	});
});
