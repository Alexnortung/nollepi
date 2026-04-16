import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SubagentState } from "../../extensions/workflows/state/subagent-state.ts";
import type { InvestigatorResult, ReviewerResult } from "../../extensions/workflows/subagents/contracts.ts";

describe("SubagentState", () => {
	it("starts a run and enforces one active run per role", () => {
		const state = new SubagentState();
		state.startRun({
			role: "investigator",
			taskId: "01-task",
			stepId: "step-1",
			goal: "Find relevant files",
			taskPreview: "Investigate repo structure",
		});

		assert.equal(state.canDispatch("investigator"), false);
		assert.equal(state.canDispatch("builder"), true);
		assert.equal(state.getActiveRuns().length, 1);
	});

	it("records streaming text and tool count on the active run", () => {
		const state = new SubagentState();
		const run = state.startRun({
			role: "builder",
			taskId: "01-task",
			goal: "Implement task",
			taskPreview: "Build feature",
		});

		state.appendText(run.id, "hello ");
		state.appendText(run.id, "world");
		state.recordToolCall(run.id);
		state.recordToolCall(run.id);

		const current = state.getRun(run.id)!;
		assert.equal(current.outputText, "hello world");
		assert.equal(current.toolCalls, 2);
	});

	it("finishes a run and stores structured result", () => {
		const state = new SubagentState();
		const run = state.startRun({
			role: "investigator",
			taskId: "01-task",
			goal: "Find risks",
			taskPreview: "Inspect risks",
		});

		const result: InvestigatorResult = {
			role: "investigator",
			findings: ["Uses ad-hoc parsing"],
			relevantFiles: ["src/parser.ts"],
			risks: ["Parser duplicated"],
			openQuestions: [],
			suggestedNextAction: "Align on parser reuse",
		};

		state.finishRun(run.id, result, "done");

		const finished = state.getRun(run.id)!;
		assert.equal(finished.status, "done");
		assert.deepEqual(finished.result, result);
		assert.equal(state.canDispatch("investigator"), true);
	});

	it("returns prior findings for a task", () => {
		const state = new SubagentState();
		const run = state.startRun({
			role: "investigator",
			taskId: "01-task",
			goal: "Inspect domain language",
			taskPreview: "Find domain terms",
		});
		state.finishRun(run.id, {
			role: "investigator",
			findings: ["Repo uses 'workflow run' consistently"],
			relevantFiles: ["docs/workflows/overview.md"],
			risks: [],
			openQuestions: [],
			suggestedNextAction: "Use workflow run in prompts",
		}, "done");

		assert.deepEqual(state.getInvestigatorFindings("01-task"), ["Repo uses 'workflow run' consistently"]);
	});

	it("drops in-flight runs on restore but keeps finished runs", () => {
		const state = new SubagentState();
		state.startRun({
			role: "builder",
			taskId: "01-task",
			goal: "Implement task",
			taskPreview: "Build feature",
		});
		const finished = state.startRun({
			role: "reviewer",
			taskId: "01-task",
			goal: "Review task",
			taskPreview: "Review feature",
		});
		const result: ReviewerResult = {
			role: "reviewer",
			verdict: "pass",
			issues: [],
			verificationGaps: [],
			suggestedNextAction: "Advance to human review",
		};
		state.finishRun(finished.id, result, "done");

		const restored = SubagentState.restore(state.serialize());
		assert.equal(restored.getActiveRuns().length, 0);
		assert.equal(restored.runs.length, 1);
		assert.equal(restored.runs[0].role, "reviewer");
	});
});
