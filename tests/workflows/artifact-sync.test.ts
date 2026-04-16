import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { TaskState } from "../../extensions/workflows/state/task-state.ts";
import { writeWorkflowArtifacts } from "../../extensions/workflows/artifacts/writer.ts";
import { readTaskStateFromArtifacts } from "../../extensions/workflows/artifacts/reader.ts";

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
		assert.equal(restored.taskState.tasks.length, 1);
		assert.equal(restored.taskState.tasks[0].id, "01-update-domain-types");
		assert.equal(restored.taskState.tasks[0].steps.length, 1);
		assert.deepEqual(restored.taskState.tasks[0].commitHashes, ["abc123"]);

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
