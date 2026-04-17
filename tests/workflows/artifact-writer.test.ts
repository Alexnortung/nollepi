import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	renderWorkflowMd,
	renderTaskMd,
	renderStepMd,
	writeWorkflowArtifacts,
} from "../../extensions/workflows/artifacts/writer.ts";
import { TaskState } from "../../extensions/workflows/state/task-state.ts";

describe("artifact writer", () => {
	it("renders workflow ledger markdown", () => {
		const state = new TaskState();
		state.addTask({
			summary: "Update domain types",
			description: "Commit-worthy change",
			alignmentNeeded: true,
		});
		state.recordTaskCommit("01-update-domain-types", "abc123");

		const markdown = renderWorkflowMd({
			title: "Button variants",
			workflowType: "alignment",
			workflowState: "task-execution",
			runId: "2026-04-16-01-alignment-button-variants",
			taskState: state,
		});

		assert.match(markdown, /^# Button variants$/m);
		assert.match(markdown, /^- Workflow type: alignment$/m);
		assert.match(markdown, /^- Workflow state: task-execution$/m);
		assert.match(markdown, /^- \[proposed\] 01-update-domain-types — Update domain types$/m);
		assert.match(markdown, /^  - Commits: abc123$/m);
	});

	it("renders task dossier markdown", () => {
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

		const markdown = renderTaskMd(state.tasks[0]);

		assert.match(markdown, /^# Update domain types$/m);
		assert.match(markdown, /^- Task id: 01-update-domain-types$/m);
		assert.match(markdown, /^- Status: proposed$/m);
		assert.match(markdown, /^## Description$/m);
		assert.match(markdown, /^## Steps$/m);
		assert.match(markdown, /^1\. \[pending\] Change exported types$/m);
	});

	it("renders optional step markdown", () => {
		const markdown = renderStepMd({
			id: "step-2",
			summary: "Variant prop contract",
			description: "Document large step separately",
			status: "pending",
			hasArtifact: true,
			artifactPath: "step-2-variant-prop-contract.md",
		});

		assert.match(markdown, /^# Variant prop contract$/m);
		assert.match(markdown, /^- Step id: step-2$/m);
		assert.match(markdown, /^- Status: pending$/m);
	});

	it("creates docs/.workflows and the run folder as soon as workflow data exists", async () => {
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-writer-"));
		const state = new TaskState();
		const runId = "2026-04-17-01-alignment-button-variants";

		await writeWorkflowArtifacts(tmpDir, {
			runId,
			title: "Button variants",
			workflowType: "alignment",
			workflowState: "intake",
			taskState: state,
		});

		assert.equal((await fs.stat(path.join(tmpDir, "docs/.workflows"))).isDirectory(), true);
		assert.equal((await fs.stat(path.join(tmpDir, "docs/.workflows/runs"))).isDirectory(), true);
		assert.equal((await fs.stat(path.join(tmpDir, `docs/.workflows/runs/${runId}`))).isDirectory(), true);
		assert.equal((await fs.stat(path.join(tmpDir, `docs/.workflows/runs/${runId}/workflow.md`))).isFile(), true);

		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	it("keeps the run folder writable once task data is available", async () => {
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-writer-"));
		const state = new TaskState();
		state.addTask({
			summary: "Update domain types",
			description: "Commit-worthy change",
			alignmentNeeded: true,
		});
		const runId = "2026-04-17-01-alignment-button-variants";

		await writeWorkflowArtifacts(tmpDir, {
			runId,
			title: "Button variants",
			workflowType: "alignment",
			workflowState: "task-proposal",
			taskState: state,
		});

		assert.equal(
			(await fs.stat(path.join(tmpDir, `docs/.workflows/runs/${runId}/tasks/01-update-domain-types`))).isDirectory(),
			true,
		);
		assert.equal(
			(await fs.stat(path.join(tmpDir, `docs/.workflows/runs/${runId}/tasks/01-update-domain-types/task.md`))).isFile(),
			true,
		);

		await fs.rm(tmpDir, { recursive: true, force: true });
	});
});
