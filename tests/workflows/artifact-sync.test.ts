import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { TaskState } from "../../extensions/workflows/state/task-state.ts";
import { restorePersistedWorkflowState, toPersistedWorkflowState } from "../../extensions/workflows/state/persisted-state.ts";
import { createWorkflowRuntime } from "../../extensions/workflows/state/workflow-state.ts";
import { writeWorkflowArtifacts } from "../../extensions/workflows/state/artifacts/writer.ts";
import { readTaskStateFromArtifacts } from "../../extensions/workflows/state/artifacts/reader.ts";

describe("artifact sync", () => {
	it("writes workflow artifacts then reads task state back", async () => {
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-artifacts-"));
		const state = new TaskState();
		state.addTask({
			summary: "Update domain types",
			description: "Commit-worthy change",
			alignmentNeeded: true,
		});
		state.addStep({
			taskId: "01-update-domain-types",
			summary: "Change exported types",
			description: "Update exported types and callers",
			hasArtifact: false,
		});
		state.recordTaskCommit("01-update-domain-types", "abc123");
		state.updateTask("01-update-domain-types", { status: "committed" });

		await writeWorkflowArtifacts(tmpDir, {
			runId: "2026-04-16-01-alignment-button-variants",
			title: "Button variants",
			workflowType: "alignment",
			workflowState: "task-execution",
			taskState: state,
		});

		const restored = await readTaskStateFromArtifacts(
			tmpDir,
			"2026-04-16-01-alignment-button-variants",
		);

		assert.equal(restored.warnings.length, 0);
		assert.equal(restored.workflow.title, "Button variants");
		assert.equal(restored.workflow.workflowType, "alignment");
		assert.equal(restored.workflow.workflowState, "task-execution");
		assert.equal(restored.taskState.runTitle, "Button variants");
		assert.equal(restored.taskState.tasks.length, 1);
		assert.equal(restored.taskState.tasks[0].id, "01-update-domain-types");
		assert.equal(restored.taskState.tasks[0].summary, "Update domain types");
		assert.equal(restored.taskState.tasks[0].steps.length, 1);
		assert.deepEqual(restored.taskState.tasks[0].commitHashes, ["abc123"]);

		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	it("reads user edits from task and step artifacts", async () => {
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-artifacts-"));
		const runId = "2026-04-16-01-alignment-button-variants";
		const workflowDir = path.join(tmpDir, "docs/.workflows/runs", runId);
		const taskDir = path.join(workflowDir, "tasks/01-update-domain-types");
		await fs.mkdir(taskDir, { recursive: true });

		await fs.writeFile(
			path.join(workflowDir, "workflow.md"),
			`# Button variants\n\n- Workflow type: alignment\n- Workflow state: task-execution\n- Run id: ${runId}\n\n## Tasks\n- [review] 01-update-domain-types — Old summary\n`,
		);
		await fs.writeFile(
			path.join(taskDir, "task.md"),
			`# Human updated summary\n\n- Task id: 01-update-domain-types\n- Status: review\n- Alignment needed: false\n- Commits: None\n\n## Description\nHuman updated description\n\n## Steps\n1. [in-progress] Review API contract (step-1-api-contract.md)\n`,
		);
		await fs.writeFile(
			path.join(taskDir, "step-1-api-contract.md"),
			`# Human updated step\n\n- Step id: step-1\n- Status: in-progress\n\n## Description\nDetailed reviewer notes\n`,
		);

		const restored = await readTaskStateFromArtifacts(tmpDir, runId);
		assert.equal(restored.warnings.length, 0);
		assert.equal(restored.taskState.tasks[0].summary, "Human updated summary");
		assert.equal(restored.taskState.tasks[0].description, "Human updated description");
		assert.equal(restored.taskState.tasks[0].status, "review");
		assert.equal(restored.taskState.tasks[0].alignmentNeeded, false);
		assert.equal(restored.taskState.tasks[0].steps[0].summary, "Human updated step");
		assert.equal(restored.taskState.tasks[0].steps[0].description, "Detailed reviewer notes");
		assert.equal(restored.taskState.tasks[0].steps[0].status, "in-progress");

		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	it("preserves step artifact links across persistence restore and the next artifact sync", async () => {
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-artifacts-"));
		const runtime = createWorkflowRuntime();
		runtime.switchTo("alignment");
		runtime.transition("intake");
		runtime.transition("high-level-alignment");
		runtime.transition("task-proposal");
		runtime.transition("task-list-alignment");
		runtime.transition("task-list-approval");
		runtime.transition("task-execution");
		runtime.runId = "2026-04-19-01-alignment-artifact-linkage";

		const taskState = new TaskState();
		taskState.runTitle = "Artifact linkage regression";
		const task = taskState.addTask({
			summary: "Keep artifact linkage on resume",
			description: "Restore persisted state without dropping step artifact links.",
			alignmentNeeded: true,
		});
		taskState.updateTask(task.id, { status: "in-progress" });
		taskState.addStep({
			taskId: task.id,
			summary: "Sync workflow artifacts",
			description: "Write task and step artifacts for the current run.",
			hasArtifact: true,
			artifactPath: "step-1-sync-workflow-artifacts.md",
		});

		await writeWorkflowArtifacts(tmpDir, {
			runId: runtime.runId,
			title: taskState.runTitle,
			workflowType: runtime.activeWorkflow,
			workflowState: runtime.workflowState,
			taskState,
		});

		const restored = restorePersistedWorkflowState(toPersistedWorkflowState(runtime, taskState));
		const artifactBacked = await readTaskStateFromArtifacts(tmpDir, runtime.runId);
		restored.taskState.rehydrateArtifactLinkage(artifactBacked.taskState);
		await writeWorkflowArtifacts(tmpDir, {
			runId: runtime.runId,
			title: restored.taskState.runTitle ?? runtime.runId,
			workflowType: restored.runtime.activeWorkflow,
			workflowState: restored.runtime.workflowState,
			taskState: restored.taskState,
		});

		const reread = await readTaskStateFromArtifacts(tmpDir, runtime.runId);
		assert.equal(reread.taskState.tasks[0].steps[0].hasArtifact, true);
		assert.equal(reread.taskState.tasks[0].steps[0].artifactPath, "step-1-sync-workflow-artifacts.md");

		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	it("warns when workflow and task commits disagree", async () => {
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-artifacts-"));
		const runId = "2026-04-16-01-alignment-button-variants";
		const workflowDir = path.join(tmpDir, "docs/.workflows/runs", runId);
		const taskDir = path.join(workflowDir, "tasks/01-update-domain-types");
		await fs.mkdir(taskDir, { recursive: true });

		await fs.writeFile(
			path.join(workflowDir, "workflow.md"),
			`# Button variants\n\n- Workflow type: alignment\n- Workflow state: task-execution\n- Run id: ${runId}\n\n## Tasks\n- [committed] 01-update-domain-types — Update domain types\n  - Commits: abc123\n`,
		);
		await fs.writeFile(
			path.join(taskDir, "task.md"),
			`# Update domain types\n\n- Task id: 01-update-domain-types\n- Status: committed\n- Alignment needed: true\n- Commits: abc123, def456\n\n## Description\nCommit-worthy change\n\n## Steps\n1. [done] Change exported types\n`,
		);

		const restored = await readTaskStateFromArtifacts(tmpDir, runId);
		assert.equal(restored.warnings.length, 1);
		assert.match(restored.warnings[0], /Artifact mismatch/);

		await fs.rm(tmpDir, { recursive: true, force: true });
	});
});
