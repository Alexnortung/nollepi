import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	serializeState,
	restoreState,
	type WorkflowExtensionState,
} from "../../extensions/workflows/state/persistence.ts";
import { SubagentState } from "../../extensions/workflows/state/subagent-state.ts";
import { TaskOrchestratorState } from "../../extensions/workflows/state/task-orchestrator-state.ts";
import { createWorkflowRuntime } from "../../extensions/workflows/state/workflow-state.ts";

describe("persistence", () => {
	it("serializes and restores workflow state", () => {
		const runtime = createWorkflowRuntime();
		runtime.switchTo("alignment");
		runtime.transition("intake");
		runtime.runId = "2026-04-16-01-test";

		const mtimes = new Map<string, number>();
		mtimes.set("docs/.workflows/runs/2026-04-16-01-test/workflow.md", 1713200000000);

		const serialized = serializeState(runtime, mtimes);
		assert.equal(serialized.workflow.activeWorkflow, "alignment");
		assert.equal(serialized.workflow.workflowState, "intake");
		assert.equal(serialized.workflow.runId, "2026-04-16-01-test");
		assert.equal(serialized.artifactMtimes.length, 1);

		const { runtime: restored, artifactMtimes } = restoreState(serialized);
		assert.equal(restored.activeWorkflow, "alignment");
		assert.equal(restored.workflowState, "intake");
		assert.equal(restored.runId, "2026-04-16-01-test");
		assert.equal(artifactMtimes.size, 1);
	});

	it("serializes and restores subagent state while dropping in-flight runs", () => {
		const runtime = createWorkflowRuntime();
		const mtimes = new Map<string, number>();
		const subagents = new SubagentState();
		subagents.startRun({ role: "builder", taskId: "01-task", goal: "Build", taskPreview: "Build" });
		const finished = subagents.startRun({ role: "reviewer", taskId: "01-task", goal: "Review", taskPreview: "Review" });
		subagents.finishRun(finished.id, {
			role: "reviewer",
			verdict: "pass",
			issues: [],
			verificationGaps: [],
			suggestedNextAction: "Advance",
		}, "done");

		const serialized = serializeState(runtime, mtimes, undefined, undefined, subagents);
		const restored = restoreState(serialized);
		assert.equal(restored.subagentState.getActiveRuns().length, 0);
		assert.equal(restored.subagentState.runs.length, 1);
		assert.equal(restored.subagentState.runs[0].id, finished.id);
	});

	it("serializes and restores task orchestrator state", () => {
		const runtime = createWorkflowRuntime();
		const mtimes = new Map<string, number>();
		const taskOrchestratorState = new TaskOrchestratorState();
		taskOrchestratorState.startOrReuseSession({ taskId: "01-task", taskPreview: "Task", sessionFile: "/tmp/task.jsonl" });
		taskOrchestratorState.startTurn();
		taskOrchestratorState.enqueueFollowUpMessage("queued specialist result");
		taskOrchestratorState.requestCloseAfterDrain();

		const serialized = serializeState(runtime, mtimes, undefined, undefined, undefined, taskOrchestratorState);
		const restored = restoreState(serialized);
		assert.equal(restored.taskOrchestratorState.getSession()?.taskId, "01-task");
		assert.equal(restored.taskOrchestratorState.getSession()?.status, "waiting");
		assert.deepEqual(restored.taskOrchestratorState.getSession()?.queuedFollowUpMessages, ["queued specialist result"]);
		assert.equal(restored.taskOrchestratorState.getSession()?.pendingCloseAfterDrain, true);
	});

	it("restoreState returns defaults for undefined input", () => {
		const { runtime, artifactMtimes } = restoreState(undefined);
		assert.equal(runtime.activeWorkflow, "base");
		assert.equal(runtime.workflowState, "idle");
		assert.equal(artifactMtimes.size, 0);
	});
});
