import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { buildWorkflowPrompt } from "../../extensions/workflows/prompts/prompt-builder.ts";
import { ArtifactWorkflowPersistenceBackend } from "../../extensions/workflows/state/artifact-workflow-persistence.ts";
import { restorePersistedWorkflowState, toPersistedWorkflowState } from "../../extensions/workflows/state/persisted-state.ts";
import { createWorkflowRuntime } from "../../extensions/workflows/state/workflow-state.ts";
import { getToolsForWorkflow } from "../../extensions/workflows/tools/tool-sets.ts";

describe("workflow system integration", () => {
	it("full lifecycle: base → alignment → finish → base", async () => {
		const runtime = createWorkflowRuntime();

		assert.equal(runtime.activeWorkflow, "base");
		assert.equal(buildWorkflowPrompt(runtime).includes("base"), true);
		assert.ok(getToolsForWorkflow("base", "idle").includes("workflow_switch"));

		runtime.switchTo("alignment");
		assert.equal(runtime.activeWorkflow, "alignment");
		assert.equal(runtime.workflowState, "idle");

		runtime.transition("intake");
		assert.equal(runtime.workflowState, "intake");
		assert.equal(runtime.canSwitch(), false);

		const alignmentPrompt = buildWorkflowPrompt(runtime);
		assert.ok(alignmentPrompt.includes("[ALIGNMENT WORKFLOW]"));
		assert.ok(alignmentPrompt.includes("intake"));

		runtime.runId = "2026-04-16-01-test";

		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-workflow-integration-"));
		try {
			const backend = new ArtifactWorkflowPersistenceBackend(tmpDir);
			const save = await backend.save({
				state: toPersistedWorkflowState(runtime, undefined, undefined),
				expectedRevision: undefined,
			});
			assert.equal(save.ok, true);
			const loaded = await backend.load();
			const { runtime: restored } = restorePersistedWorkflowState(loaded?.state);
			assert.equal(restored.activeWorkflow, "alignment");
			assert.equal(restored.workflowState, "intake");
			assert.equal(restored.runId, "2026-04-16-01-test");
		} finally {
			await fs.rm(tmpDir, { recursive: true, force: true });
		}

		assert.equal(runtime.canSwitch(), false);
		assert.throws(() => runtime.switchTo("base"));

		runtime.transition("high-level-alignment");
		runtime.transition("task-proposal");
		runtime.transition("task-list-alignment");
		runtime.transition("task-list-approval");
		runtime.transition("task-execution");
		runtime.transition("internal-review");
		runtime.transition("human-review");
		runtime.transition("finish");
		assert.equal(runtime.canSwitch(), true);

		runtime.switchTo("base");
		assert.equal(runtime.activeWorkflow, "base");
		assert.equal(runtime.workflowState, "idle");
	});

	it("full lifecycle: base → autonomous → finish → base", () => {
		const runtime = createWorkflowRuntime();
		runtime.switchTo("autonomous");
		runtime.transition("intake");

		assert.equal(runtime.canSwitch(), false);

		const prompt = buildWorkflowPrompt(runtime);
		assert.ok(prompt.includes("[AUTONOMOUS WORKFLOW]"));

		runtime.transition("lightweight-alignment");
		runtime.transition("issue-understanding");
		runtime.transition("planning");
		runtime.transition("task-execution");
		runtime.transition("self-review");
		runtime.transition("verification");
		runtime.transition("commit");
		runtime.transition("pull-request");
		runtime.transition("finish");

		assert.equal(runtime.canSwitch(), true);
		runtime.switchTo("base");
		assert.equal(runtime.activeWorkflow, "base");
	});
});
