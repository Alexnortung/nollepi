import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MtimeTracker } from "../../extensions/workflows/artifacts/mtime-tracker.ts";
import { buildWorkflowPrompt } from "../../extensions/workflows/prompts/prompt-builder.ts";
import { restoreState, serializeState } from "../../extensions/workflows/state/persistence.ts";
import { createWorkflowRuntime } from "../../extensions/workflows/state/workflow-state.ts";
import { getToolsForWorkflow } from "../../extensions/workflows/tools/tool-sets.ts";

describe("workflow system integration", () => {
	it("full lifecycle: base → alignment → finish → base", () => {
		const runtime = createWorkflowRuntime();
		const tracker = new MtimeTracker();

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
		const serialized = serializeState(runtime, tracker.toMap());
		const { runtime: restored } = restoreState(serialized);
		assert.equal(restored.activeWorkflow, "alignment");
		assert.equal(restored.workflowState, "intake");
		assert.equal(restored.runId, "2026-04-16-01-test");

		assert.equal(restored.canSwitch(), false);
		assert.throws(() => restored.switchTo("base"));

		restored.transition("high-level-alignment");
		restored.transition("task-proposal");
		restored.transition("task-list-alignment");
		restored.transition("task-list-approval");
		restored.transition("task-execution");
		restored.transition("internal-review");
		restored.transition("human-review");
		restored.transition("approved");
		restored.transition("commit");
		restored.transition("finish");
		assert.equal(restored.canSwitch(), true);

		restored.switchTo("base");
		assert.equal(restored.activeWorkflow, "base");
		assert.equal(restored.workflowState, "idle");
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
