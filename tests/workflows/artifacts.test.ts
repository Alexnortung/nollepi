import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createWorkflowArtifacts, deriveWorkflowSummaryFromArtifacts, syncTaskCommits } from "../../extensions/workflows/shared/artifacts";

test("createWorkflowArtifacts creates workflow.md and task folders", async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-artifacts-"));
	const runDir = path.join(dir, "2026-04-15-01-alignment-demo");

	await createWorkflowArtifacts({
		runDirectory: runDir,
		workflow: "alignment",
		title: "Demo Workflow",
		tasks: [{ id: "01-setup", title: "Setup workflow package", summary: "Create workflow extension package" }],
	});

	const workflowMd = await fs.readFile(path.join(runDir, "workflow.md"), "utf8");
	const taskMd = await fs.readFile(path.join(runDir, "tasks", "01-setup", "task.md"), "utf8");

	assert.match(workflowMd, /# Demo Workflow/);
	assert.match(workflowMd, /- \[ \] Task 01: Setup workflow package/);
	assert.match(taskMd, /# Task 01: Setup workflow package/);
	assert.match(taskMd, /Create workflow extension package/);
});

test("deriveWorkflowSummaryFromArtifacts rebuilds workflow state from workflow.md", async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-artifacts-"));
	const runDir = path.join(dir, "2026-04-15-01-alignment-demo");

	await createWorkflowArtifacts({
		runDirectory: runDir,
		workflow: "alignment",
		title: "Demo Workflow",
		tasks: [{ id: "01-setup", title: "Setup workflow package", summary: "Create workflow extension package" }],
	});

	const summary = await deriveWorkflowSummaryFromArtifacts(runDir);
	assert.equal(summary.workflow, "alignment");
	assert.equal(summary.state, "intake");
	assert.equal(summary.done, false);
	assert.equal(summary.runDirectory, runDir);
});

test("syncTaskCommits updates both workflow.md and task.md", async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-artifacts-"));
	const runDir = path.join(dir, "2026-04-15-01-alignment-demo");

	await createWorkflowArtifacts({
		runDirectory: runDir,
		workflow: "alignment",
		title: "Demo Workflow",
		tasks: [{ id: "01-setup", title: "Setup workflow package", summary: "Create workflow extension package" }],
	});

	await syncTaskCommits(runDir, "01-setup", ["abc1234", "def5678"]);

	const workflowMd = await fs.readFile(path.join(runDir, "workflow.md"), "utf8");
	const taskMd = await fs.readFile(path.join(runDir, "tasks", "01-setup", "task.md"), "utf8");

	assert.match(workflowMd, /abc1234/);
	assert.match(workflowMd, /def5678/);
	assert.match(taskMd, /abc1234/);
	assert.match(taskMd, /def5678/);
});
