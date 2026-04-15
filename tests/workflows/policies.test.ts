import { strict as assert } from "node:assert";
import test from "node:test";
import { canStartWorkflow, canSwitchWorkflow, getGuardPolicy, requiresSandbox } from "../../extensions/workflows/shared/policies";

test("alignment workflow may not switch before done", () => {
	assert.equal(canSwitchWorkflow({ currentWorkflow: "alignment", done: false }), false);
	assert.equal(canSwitchWorkflow({ currentWorkflow: "alignment", done: true }), true);
});

test("autonomous requires sandbox and disables guards", () => {
	assert.equal(requiresSandbox("autonomous"), true);
	assert.deepEqual(getGuardPolicy("autonomous"), { commandGuard: false, pathGuard: false });
	assert.deepEqual(getGuardPolicy("alignment"), { commandGuard: true, pathGuard: true });
});

test("autonomous start is rejected when sandbox is unavailable", () => {
	assert.equal(canStartWorkflow({ workflow: "autonomous", sandboxAvailable: false, worktreeReady: true }).ok, false);
	assert.equal(canStartWorkflow({ workflow: "autonomous", sandboxAvailable: true, worktreeReady: true }).ok, true);
});
