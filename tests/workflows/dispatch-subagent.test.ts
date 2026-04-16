import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AlignmentState } from "../../extensions/workflows/state/alignment-state.ts";
import { SubagentState } from "../../extensions/workflows/state/subagent-state.ts";
import { TaskState } from "../../extensions/workflows/state/task-state.ts";
import { createWorkflowRuntime } from "../../extensions/workflows/state/workflow-state.ts";
import { prepareSubagentDispatch, shouldAutoTriggerSubagentResult } from "../../extensions/workflows/tools/dispatch-subagent.ts";

describe("prepareSubagentDispatch", () => {
	it("rejects dispatch outside alignment/autonomous workflows", () => {
		const runtime = createWorkflowRuntime();
		const taskState = new TaskState();
		const alignmentState = new AlignmentState();
		const subagentState = new SubagentState();

		assert.throws(
			() => prepareSubagentDispatch({ runtime, taskState, alignmentState, subagentState }, {
				role: "investigator",
				goal: "Inspect repo",
				successTarget: "Return findings",
			}),
			/alignment or autonomous/,
		);
	});

	it("creates a builder run and packet when current task exists", () => {
		const runtime = createWorkflowRuntime();
		runtime.switchTo("alignment");
		runtime.transition("intake");
		runtime.transition("high-level-alignment");
		runtime.transition("task-proposal");
		runtime.transition("task-list-alignment");
		runtime.transition("task-list-approval");
		runtime.transition("task-execution");
		const taskState = new TaskState();
		taskState.addTask({ summary: "Build it", description: "Implement builder", alignmentNeeded: true });
		taskState.selectCurrentTask("01-build-it");
		const alignmentState = new AlignmentState();
		alignmentState.addPart("objective", { summary: "Add builder", details: "" });
		alignmentState.confirmPart("objective", "part-1");
		const subagentState = new SubagentState();

		const prepared = prepareSubagentDispatch(
			{ runtime, taskState, alignmentState, subagentState },
			{ role: "builder", goal: "Implement it", successTarget: "Code changes", doneCriteria: ["tests pass"] },
		);

		assert.equal(prepared.run.role, "builder");
		assert.equal(prepared.packet.role, "builder");
		assert.equal(subagentState.getActiveRuns().length, 1);
	});

	it("rejects duplicate running role", () => {
		const runtime = createWorkflowRuntime();
		runtime.switchTo("alignment");
		runtime.transition("intake");
		runtime.transition("high-level-alignment");
		runtime.transition("task-proposal");
		runtime.transition("task-list-alignment");
		runtime.transition("task-list-approval");
		runtime.transition("task-execution");
		const taskState = new TaskState();
		taskState.addTask({ summary: "Build it", description: "Implement builder", alignmentNeeded: true });
		taskState.selectCurrentTask("01-build-it");
		const alignmentState = new AlignmentState();
		const subagentState = new SubagentState();
		subagentState.startRun({ role: "builder", taskId: "01-build-it", goal: "Build", taskPreview: "Build" });

		assert.throws(
			() => prepareSubagentDispatch(
				{ runtime, taskState, alignmentState, subagentState },
				{ role: "builder", goal: "Implement it", successTarget: "Code changes", doneCriteria: ["tests pass"] },
			),
			/already running/,
		);
	});
});

describe("shouldAutoTriggerSubagentResult", () => {
	it("returns true only for alignment/autonomous when idle", () => {
		assert.equal(shouldAutoTriggerSubagentResult("alignment", true), true);
		assert.equal(shouldAutoTriggerSubagentResult("autonomous", true), true);
		assert.equal(shouldAutoTriggerSubagentResult("base", true), false);
		assert.equal(shouldAutoTriggerSubagentResult("alignment", false), false);
	});
});
