import { strict as assert } from "node:assert";
import test from "node:test";
import { restoreUiStateFromBranch } from "../../extensions/workflows/shared/session";

test("restoreUiStateFromBranch returns the latest workflow-ui-state entry", () => {
	const state = restoreUiStateFromBranch([
		{ type: "custom", customType: "workflow-ui-state", data: { expandedTaskIds: ["01-setup"] } },
		{ type: "custom", customType: "workflow-ui-state", data: { expandedTaskIds: ["02-sidebar"] } },
	] as any);

	assert.deepEqual(state, { expandedTaskIds: ["02-sidebar"] });
});
