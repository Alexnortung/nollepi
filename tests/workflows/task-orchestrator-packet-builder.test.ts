import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AlignmentState } from "../../extensions/workflows/state/alignment-state.ts";
import { SubagentState } from "../../extensions/workflows/state/subagent-state.ts";
import { TaskState } from "../../extensions/workflows/state/task-state.ts";
import { createWorkflowRuntime } from "../../extensions/workflows/state/workflow-state.ts";
import { buildTaskOrchestratorPacket } from "../../extensions/workflows/task-orchestrator/packet-builder.ts";

describe("buildTaskOrchestratorPacket", () => {
	it("includes aligned context, prior task summaries, and latest builder result", () => {
		const runtime = createWorkflowRuntime({ activeWorkflow: "alignment", workflowState: "human-review", runId: "run-1" });
		const taskState = new TaskState();
		taskState.addTask({ summary: "Previous task", description: "Prev", alignmentNeeded: false });
		taskState.recordTaskOutcome("01-previous-task", {
			changedFiles: ["src/old.ts"],
			relevantSymbols: ["OldThing"],
			notes: ["Important prior context"],
		});
		taskState.addTask({ summary: "Current task", description: "Now", alignmentNeeded: true });
		taskState.selectCurrentTask("02-current-task");

		const alignment = new AlignmentState();
		alignment.addPart("objective", { summary: "Do thing", details: "Objective" });
		alignment.addPart("constraints", { summary: "Stay focused", details: "Constraint" });
		alignment.confirmPart("objective", "part-1");
		alignment.confirmPart("constraints", "part-2");

		const subagents = new SubagentState();
		const run = subagents.startRun({ role: "builder", taskId: "02-current-task", goal: "Build", taskPreview: "Current task" });
		subagents.finishRun(run.id, {
			role: "builder",
			summary: "Implemented current task",
			changedFiles: ["src/current.ts"],
			commits: ["abc123"],
			verification: ["pnpm test"],
			blockers: [],
		}, "done");

		const packet = buildTaskOrchestratorPacket({ runtime, taskState, alignmentState: alignment, subagentState: subagents });
		assert.equal(packet.task.id, "02-current-task");
		assert.ok(packet.alignedContext.objective.includes("Do thing"));
		assert.ok(packet.alignedContext.constraints.includes("Stay focused"));
		assert.equal(packet.priorTaskSummaries.length, 1);
		assert.deepEqual(packet.priorTaskSummaries[0].changedFiles, ["src/old.ts"]);
		assert.equal(packet.latestBuilderResult?.summary, "Implemented current task");
		assert.deepEqual(packet.latestBuilderResult?.changedFiles, ["src/current.ts"]);
	});
});
