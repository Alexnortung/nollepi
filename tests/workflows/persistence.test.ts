import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	serializeState,
	restoreState,
	type WorkflowExtensionState,
} from "../../extensions/workflows/state/persistence.ts";
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

	it("restoreState returns defaults for undefined input", () => {
		const { runtime, artifactMtimes } = restoreState(undefined);
		assert.equal(runtime.activeWorkflow, "base");
		assert.equal(runtime.workflowState, "idle");
		assert.equal(artifactMtimes.size, 0);
	});
});
