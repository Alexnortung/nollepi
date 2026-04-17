import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	createWorkflowRuntime,
	type WorkflowName,
	type WorkflowRuntime,
} from "../../extensions/workflows/state/workflow-state.ts";

describe("WorkflowRuntime", () => {
	it("starts in base/idle", () => {
		const rt = createWorkflowRuntime();
		assert.equal(rt.activeWorkflow, "base");
		assert.equal(rt.workflowState, "idle");
		assert.equal(rt.runId, undefined);
	});

	it("can switch from base to any workflow", () => {
		const rt = createWorkflowRuntime();
		assert.equal(rt.canSwitch(), true);

		rt.switchTo("superpowers");
		assert.equal(rt.activeWorkflow, "superpowers");
		assert.equal(rt.workflowState, "idle");
	});

	it("cannot switch from alignment unless in finish state", () => {
		const rt = createWorkflowRuntime();
		rt.switchTo("alignment");
		rt.transition("intake");
		assert.equal(rt.canSwitch(), false);

		rt.transition("high-level-alignment");
		rt.transition("task-proposal");
		rt.transition("task-list-alignment");
		rt.transition("task-list-approval");
		rt.transition("task-execution");
		rt.transition("internal-review");
		rt.transition("human-review");
		rt.transition("approved");
		rt.transition("commit");
		rt.transition("finish");
		assert.equal(rt.canSwitch(), true);
	});

	it("cannot switch from autonomous unless in finish state", () => {
		const rt = createWorkflowRuntime();
		rt.switchTo("autonomous");
		rt.transition("intake");
		assert.equal(rt.canSwitch(), false);

		rt.transition("lightweight-alignment");
		rt.transition("issue-understanding");
		rt.transition("planning");
		rt.transition("task-execution");
		rt.transition("self-review");
		rt.transition("verification");
		rt.transition("commit");
		rt.transition("pull-request");
		rt.transition("finish");
		assert.equal(rt.canSwitch(), true);
	});

	it("superpowers is switchable when idle", () => {
		const rt = createWorkflowRuntime();
		rt.switchTo("superpowers");
		assert.equal(rt.canSwitch(), true);

		rt.transition("design");
		assert.equal(rt.canSwitch(), false);

		rt.transition("planning");
		rt.transition("implementing");
		rt.transition("reviewing");
		rt.transition("finishing");
		rt.transition("idle");
		assert.equal(rt.canSwitch(), true);
	});

	it("throws on invalid transition", () => {
		const rt = createWorkflowRuntime();
		assert.throws(() => rt.transition("nonexistent"), /Invalid state/);
	});

	it("throws on switch when canSwitch is false", () => {
		const rt = createWorkflowRuntime();
		rt.switchTo("alignment");
		rt.transition("intake");
		assert.throws(() => rt.switchTo("base"), /Cannot switch/);
	});

	it("serializes and deserializes", () => {
		const rt = createWorkflowRuntime();
		rt.switchTo("alignment");
		rt.transition("intake");
		rt.runId = "2026-04-16-01-alignment-test";

		const snapshot = rt.serialize();
		const restored = createWorkflowRuntime(snapshot);

		assert.equal(restored.activeWorkflow, "alignment");
		assert.equal(restored.workflowState, "intake");
		assert.equal(restored.runId, "2026-04-16-01-alignment-test");
	});

	it("clears run id whenever switching workflows", () => {
		const rt = createWorkflowRuntime();
		rt.runId = "2026-04-16-01-base-run";

		rt.switchTo("alignment");
		assert.equal(rt.runId, undefined);

		rt.runId = "2026-04-16-01-alignment-run";
		rt.transition("intake");
		rt.transition("high-level-alignment");
		rt.transition("task-proposal");
		rt.transition("task-list-alignment");
		rt.transition("task-list-approval");
		rt.transition("task-execution");
		rt.transition("internal-review");
		rt.transition("human-review");
		rt.transition("approved");
		rt.transition("commit");
		rt.transition("finish");
		rt.switchTo("autonomous");
		assert.equal(rt.runId, undefined);
	});

	it("getValidStates returns states for current workflow", () => {
		const rt = createWorkflowRuntime();
		const states = rt.getValidStates();
		assert.ok(states.includes("idle"));
	});

	it("getValidTransitions returns reachable states from current state", () => {
		const rt = createWorkflowRuntime();
		rt.switchTo("alignment");
		const transitions = rt.getValidTransitions();
		assert.ok(transitions.includes("intake"));
	});
});
