import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyStepAction } from "../../extensions/workflows/tools/step-manage.ts";
import { TaskState } from "../../extensions/workflows/state/task-state.ts";

describe("step_manage", () => {
	it("creates step", () => {
		const state = new TaskState();
		state.addTask({
			summary: "Update domain types",
			description: "Task description",
			alignmentNeeded: true,
		});

		applyStepAction(state, {
			action: "create",
			taskId: "01-update-domain-types",
			summary: "Change exported types",
			description: "Update exported types",
			hasArtifact: false,
		});

		assert.equal(state.tasks[0].steps.length, 1);
	});

	it("marks step done", () => {
		const state = new TaskState();
		state.addTask({
			summary: "Update domain types",
			description: "Task description",
			alignmentNeeded: true,
		});

		applyStepAction(state, {
			action: "create",
			taskId: "01-update-domain-types",
			summary: "Change exported types",
			description: "Update exported types",
			hasArtifact: false,
		});

		applyStepAction(state, {
			action: "complete",
			taskId: "01-update-domain-types",
			stepId: "step-1",
		});

		assert.equal(state.tasks[0].steps[0].status, "done");
	});
});
