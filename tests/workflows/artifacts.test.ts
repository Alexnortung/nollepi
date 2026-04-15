import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createWorkflowArtifacts, deriveWorkflowSummaryFromArtifacts, findActiveRun, switchWorkflow, syncTaskCommits } from "../../extensions/workflows/shared/artifacts";

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

test("findActiveRun returns undefined when no runs directory exists", async () => {
	const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "find-active-run-"));
	assert.equal(await findActiveRun(cwd), undefined);
});

test("findActiveRun returns undefined when all runs are done", async () => {
	const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "find-active-run-"));
	const runsDir = path.join(cwd, "docs", ".workflows", "runs");
	const runDir = path.join(runsDir, "2026-04-15-01-alignment-done");

	await createWorkflowArtifacts({ runDirectory: runDir, workflow: "alignment", title: "Done", tasks: [] });
	const md = await fs.readFile(path.join(runDir, "workflow.md"), "utf8");
	await fs.writeFile(path.join(runDir, "workflow.md"), md.replace("- State: intake", "- State: finish"), "utf8");

	assert.equal(await findActiveRun(cwd), undefined);
});

test("findActiveRun returns the most recent non-done run", async () => {
	const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "find-active-run-"));
	const runsDir = path.join(cwd, "docs", ".workflows", "runs");

	const doneDir = path.join(runsDir, "2026-04-15-01-alignment-done");
	await createWorkflowArtifacts({ runDirectory: doneDir, workflow: "alignment", title: "Done", tasks: [] });
	const md = await fs.readFile(path.join(doneDir, "workflow.md"), "utf8");
	await fs.writeFile(path.join(doneDir, "workflow.md"), md.replace("- State: intake", "- State: finish"), "utf8");

	const activeDir = path.join(runsDir, "2026-04-15-02-alignment-active");
	await createWorkflowArtifacts({ runDirectory: activeDir, workflow: "alignment", title: "Active", tasks: [] });

	assert.equal(await findActiveRun(cwd), activeDir);
});

test("switchWorkflow creates run directory and workflow.md", async () => {
	const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "switch-workflow-"));
	const summary = await switchWorkflow({ cwd, workflow: "alignment", title: "My Feature" });

	assert.equal(summary.workflow, "alignment");
	assert.equal(summary.state, "intake");
	assert.equal(summary.done, false);
	assert.ok(summary.runDirectory, "must have a runDirectory");

	const wfMd = await fs.readFile(path.join(summary.runDirectory!, "workflow.md"), "utf8");
	assert.match(wfMd, /# My Feature/);
	assert.match(wfMd, /- Workflow: alignment/);
	assert.match(wfMd, /- State: intake/);
});

test("switchWorkflow base workflow is immediately done with idle state", async () => {
	const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "switch-workflow-"));
	const summary = await switchWorkflow({ cwd, workflow: "base" });
	assert.equal(summary.state, "idle");
	assert.equal(summary.done, true);
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
