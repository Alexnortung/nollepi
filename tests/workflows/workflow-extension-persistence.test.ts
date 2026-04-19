import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { buildWorkflowPrompt } from "../../extensions/workflows/prompts/prompt-builder.ts";
import { AlignmentState } from "../../extensions/workflows/state/alignment-state.ts";
import { ArtifactWorkflowPersistenceBackend } from "../../extensions/workflows/state/artifact-workflow-persistence.ts";
import { restorePersistedWorkflowState, toPersistedWorkflowState } from "../../extensions/workflows/state/persisted-state.ts";
import { TaskState } from "../../extensions/workflows/state/task-state.ts";
import { createWorkflowRuntime } from "../../extensions/workflows/state/workflow-state.ts";
import { getToolsForWorkflow } from "../../extensions/workflows/tools/tool-sets.ts";

describe("workflow-owned persistence restoration", () => {
	it("restores workflow, task, step, and alignment state for the workflow extension", async () => {
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-workflow-test-"));
		try {
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
			const task = taskState.addTask({
				summary: "Persist workflow extension state through the backend",
				description: "Restore workflow state via WorkflowPersistenceBackend instead of serialize/restore.",
				alignmentNeeded: true,
			});
			taskState.updateTask(task.id, { status: "in-progress" });
			const step = taskState.addStep({
				taskId: task.id,
				summary: "Load persisted workflow state",
				description: "Restore runtime, task, and alignment state from the backend.",
				hasArtifact: false,
			});
			taskState.updateStep(task.id, step.id, { status: "in-progress" });

			const alignmentState = new AlignmentState();
			alignmentState.addPart("constraints", {
				summary: "Do not persist subagents",
				details: "Persist workflow state, tasks, steps, and alignment only.",
			});
			alignmentState.confirmPart("constraints", "part-1");

			const backend = new ArtifactWorkflowPersistenceBackend(tmpDir);
			const save = await backend.save({
				state: toPersistedWorkflowState(runtime, taskState, alignmentState),
				expectedRevision: undefined,
			});
			assert.equal(save.ok, true);

			const loaded = await backend.load();
			const restored = restorePersistedWorkflowState(loaded?.state);
			const active = restored.taskState.getActiveTaskContext();
			const tools = getToolsForWorkflow(restored.runtime.activeWorkflow, restored.runtime.workflowState);
			const prompt = buildWorkflowPrompt(restored.runtime);
			const alignmentSummary = restored.alignmentState.getSummary();

			assert.equal(restored.runtime.activeWorkflow, "alignment");
			assert.equal(restored.runtime.workflowState, "task-execution");
			assert.equal(restored.runtime.runId, runtime.runId);
			assert.deepEqual(tools, [
				"read",
				"bash",
				"edit",
				"write",
				"workflow_switch",
				"workflow_state",
				"workflow_transition",
				"task_manage",
				"step_manage",
				"task_commit",
				"alignment_manage",
				"dispatch_subagent",
			]);
			assert.match(prompt, /\[ALIGNMENT WORKFLOW\]/);
			assert.equal(active.currentTask?.id, task.id);
			assert.equal(active.currentTask?.summary, "Persist workflow extension state through the backend");
			assert.equal(active.currentStep?.id, step.id);
			assert.equal(active.currentStep?.status, "in-progress");
			assert.deepEqual(alignmentSummary, { aligned: 1, pending: 0, skipped: 0, total: 1 });
			assert.equal(restored.alignmentState.categories.find((category) => category.name === "constraints")?.parts[0]?.summary, "Do not persist subagents");
		} finally {
			await fs.rm(tmpDir, { recursive: true, force: true });
		}
	});
});
