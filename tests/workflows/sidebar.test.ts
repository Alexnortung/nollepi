import { strict as assert } from "node:assert";
import test from "node:test";
import { renderWorkflowWidget } from "../../extensions/workflows/shared/sidebar";

test("renderWorkflowWidget returns compact workflow status lines", () => {
	assert.deepEqual(
		renderWorkflowWidget({
			workflow: "alignment",
			state: "task-list-approval",
			currentTask: "Setup workflow package",
			currentStep: "Write workflow manifest",
			pendingApproval: "task-list",
		}),
		[
			"Workflow: alignment",
			"State: task-list-approval",
			"Task: Setup workflow package",
			"Step: Write workflow manifest",
			"Needs approval: task-list",
		],
	);
});
