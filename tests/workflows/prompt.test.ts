import { strict as assert } from "node:assert";
import test from "node:test";
import { buildWorkflowPromptInjection } from "../../extensions/workflows/shared/prompt";

test("buildWorkflowPromptInjection returns empty string for base workflow", () => {
	assert.equal(buildWorkflowPromptInjection({ workflow: "base", state: "idle", done: true }), "");
});

test("buildWorkflowPromptInjection injects workflow header for alignment intake", () => {
	const result = buildWorkflowPromptInjection({ workflow: "alignment", state: "intake", done: false });
	assert.match(result, /Active Workflow: alignment/);
	assert.match(result, /intake/);
	assert.match(result, /clarifying question/i);
});

test("buildWorkflowPromptInjection injects task-execution instructions for alignment", () => {
	const result = buildWorkflowPromptInjection({
		workflow: "alignment",
		state: "task-execution",
		done: false,
		currentTask: "Update domain types",
	});
	assert.match(result, /task-execution/);
	assert.match(result, /Update domain types/);
	assert.match(result, /task\.md/i);
});

test("buildWorkflowPromptInjection injects autonomous instructions", () => {
	const result = buildWorkflowPromptInjection({ workflow: "autonomous", state: "planning", done: false });
	assert.match(result, /autonomous/i);
	assert.match(result, /self-review/i);
});

test("buildWorkflowPromptInjection injects human-review gate instructions", () => {
	const result = buildWorkflowPromptInjection({
		workflow: "alignment",
		state: "human-review",
		done: false,
		pendingApproval: "task-completion",
	});
	assert.match(result, /human-review/);
	assert.match(result, /task-completion/);
	assert.match(result, /commit hash/i);
});
