import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AlignmentState } from "../../extensions/workflows/state/alignment-state.ts";
import {
	restorePersistedAlignmentState,
	restorePersistedWorkflowState,
	restorePersistedWorkflowTask,
	toPersistedAlignmentState,
	toPersistedWorkflowState,
	toPersistedWorkflowTask,
} from "../../extensions/workflows/state/persisted-state.ts";
import { TaskState } from "../../extensions/workflows/state/task-state.ts";
import { createWorkflowRuntime } from "../../extensions/workflows/state/workflow-state.ts";

describe("persisted workflow state adapters", () => {
	it("round-trips workflow, task, step, and alignment state through backend-neutral data", () => {
		const runtime = createWorkflowRuntime();
		runtime.switchTo("alignment");
		runtime.transition("intake");
		runtime.transition("high-level-alignment");
		runtime.transition("task-proposal");
		runtime.transition("task-list-alignment");
		runtime.transition("task-list-approval");
		runtime.transition("task-execution");
		runtime.runId = "2026-04-19-01-alignment-refactor-the-workflow-extension";

		const taskState = new TaskState();
		taskState.runTitle = "Workflow persistence refactor";
		taskState.runSlug = "workflow-persistence-refactor";
		const task = taskState.addTask({
			summary: "Persist workflow state through the backend",
			description: "Replace the extension-specific serialize/restore path.",
			alignmentNeeded: true,
		});
		taskState.updateTask(task.id, { status: "in-progress" });
		const step = taskState.addStep({
			taskId: task.id,
			summary: "Write backend save path",
			description: "Persist workflow-owned data through WorkflowPersistenceBackend.",
			hasArtifact: true,
			artifactPath: "step-1.md",
		});
		taskState.updateStep(task.id, step.id, { status: "done" });
		taskState.recordTaskOutcome(task.id, {
			changedFiles: [
				"extensions/workflows/index.ts",
				"extensions/workflows/state/artifact-workflow-persistence.ts",
			],
			relevantSymbols: ["persistState", "ArtifactWorkflowPersistenceBackend"],
			notes: ["Use the persistence backend for durable workflow-owned state only."],
		});
		taskState.recordTaskCommit(task.id, "deadbeef");

		const alignmentState = new AlignmentState();
		alignmentState.addPart("constraints", {
			summary: "Do not persist subagents",
			details: "Persist workflow state, tasks, steps, and alignment only.",
		});
		alignmentState.confirmPart("constraints", "part-1");

		const persisted = toPersistedWorkflowState(runtime, taskState, alignmentState);
		assert.equal(persisted.workflow, "alignment");
		assert.equal(persisted.workflowState, "task-execution");
		assert.equal(persisted.runTitle, "Workflow persistence refactor");
		assert.equal(persisted.tasks[0].alignmentRequired, true);
		assert.equal("taskDir" in persisted.tasks[0], false);
		assert.equal("taskMdPath" in persisted.tasks[0], false);
		assert.equal("hasArtifact" in persisted.tasks[0].steps[0], false);
		assert.equal("artifactPath" in persisted.tasks[0].steps[0], false);

		const restored = restorePersistedWorkflowState(persisted);
		assert.equal(restored.runtime.activeWorkflow, "alignment");
		assert.equal(restored.runtime.workflowState, "task-execution");
		assert.equal(restored.runtime.runId, runtime.runId);
		assert.equal(restored.taskState.runTitle, "Workflow persistence refactor");
		assert.equal(restored.taskState.runSlug, "workflow-persistence-refactor");
		assert.equal(restored.taskState.currentTaskId, task.id);
		assert.equal(restored.taskState.currentStepId, step.id);
		assert.equal(restored.taskState.tasks[0].taskDir, `tasks/${task.id}`);
		assert.equal(restored.taskState.tasks[0].taskMdPath, `tasks/${task.id}/task.md`);
		assert.equal(restored.taskState.tasks[0].steps[0].hasArtifact, false);
		assert.equal(restored.taskState.tasks[0].steps[0].artifactPath, undefined);
		assert.deepEqual(restored.taskState.tasks[0].outcomeSummary, taskState.tasks[0].outcomeSummary);
		assert.equal(restored.alignmentState.categories.find((category) => category.name === "constraints")?.parts[0]?.state, "aligned");

		const newPart = restored.alignmentState.addPart("constraints", {
			summary: "Revision checks are mandatory",
			details: "Use compare-and-set saves to detect stale workflow persistence writes.",
		});
		assert.equal(newPart.id, "part-2");
	});

	it("adapts individual tasks and alignment state without backend-specific fields", () => {
		const taskState = new TaskState();
		const task = taskState.addTask({
			summary: "Add adapters",
			description: "Convert task state to persisted workflow task data.",
			alignmentNeeded: false,
		});
		taskState.addStep({
			taskId: task.id,
			summary: "Strip artifact metadata",
			description: "Persist only backend-neutral step fields.",
			hasArtifact: true,
			artifactPath: "step-1.md",
		});
		const persistedTask = toPersistedWorkflowTask(taskState.tasks[0]);
		assert.equal("taskDir" in persistedTask, false);
		assert.equal("taskMdPath" in persistedTask, false);
		assert.equal("hasArtifact" in persistedTask.steps[0], false);

		const restoredTask = restorePersistedWorkflowTask(persistedTask);
		assert.equal(restoredTask.taskDir, `tasks/${persistedTask.id}`);
		assert.equal(restoredTask.taskMdPath, `tasks/${persistedTask.id}/task.md`);
		assert.equal(restoredTask.steps[0].hasArtifact, false);

		const alignmentState = new AlignmentState();
		alignmentState.addPart("scope", {
			summary: "No watch support",
			details: "The first backend only needs load/save/isStale.",
		});
		const persistedAlignment = toPersistedAlignmentState(alignmentState);
		assert.equal("nextPartId" in persistedAlignment, false);

		const restoredAlignment = restorePersistedAlignmentState(persistedAlignment);
		const added = restoredAlignment.addPart("scope", {
			summary: "Rebuild next ids",
			details: "Infer the next part id from persisted part ids.",
		});
		assert.equal(added.id, "part-2");
	});

	it("restores default in-memory state when no persisted workflow state exists", () => {
		const restored = restorePersistedWorkflowState(undefined);
		assert.equal(restored.runtime.activeWorkflow, "base");
		assert.equal(restored.runtime.workflowState, "idle");
		assert.equal(restored.taskState.tasks.length, 0);
		assert.equal(restored.alignmentState.categories.length > 0, true);
	});
});
