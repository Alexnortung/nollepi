import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { WorkflowRuntime } from "../../extensions/workflows/state/workflow-state.ts";
import { createWorkflowRuntime } from "../../extensions/workflows/state/workflow-state.ts";
import { normalizeWorkflowTransitionEvent } from "../../extensions/workflows/tools/workflow-transition-logic.ts";

function moveToAlignmentHumanReview(runtime: WorkflowRuntime): void {
	runtime.switchTo("alignment");
	runtime.transition("intake");
	runtime.transition("high-level-alignment");
	runtime.transition("task-proposal");
	runtime.transition("task-list-alignment");
	runtime.transition("task-list-approval");
	runtime.transition("task-execution");
	runtime.transition("internal-review");
	runtime.transition("human-review");
}

describe("normalizeWorkflowTransitionEvent", () => {
	it("carries commit intent data when review exits directly to next-task", () => {
		const runtime = createWorkflowRuntime();
		moveToAlignmentHumanReview(runtime);

		const result = normalizeWorkflowTransitionEvent(runtime, {
			state: "next-task",
			commitIntent: "create",
			commitMessage: "feat: reshape alignment review exits",
		});

		assert.deepEqual(result, {
			ok: true,
			event: {
				previousState: "human-review",
				newState: "next-task",
				commitIntent: "create",
				commitMessage: "feat: reshape alignment review exits",
			},
		});
	});

	it("infers create intent when only a commit message is provided", () => {
		const runtime = createWorkflowRuntime();
		moveToAlignmentHumanReview(runtime);

		const result = normalizeWorkflowTransitionEvent(runtime, {
			state: "finish",
			commitMessage: "feat: use the approved review message",
		});

		assert.deepEqual(result, {
			ok: true,
			event: {
				previousState: "human-review",
				newState: "finish",
				commitIntent: "create",
				commitMessage: "feat: use the approved review message",
			},
		});
	});

	it("rejects review commit metadata outside successful human-review exits", () => {
		const runtime = createWorkflowRuntime();
		runtime.switchTo("alignment");
		runtime.transition("intake");

		const result = normalizeWorkflowTransitionEvent(runtime, {
			state: "high-level-alignment",
			commitIntent: "create",
			commitMessage: "feat: should be rejected here",
		});

		assert.deepEqual(result, {
			ok: false,
			error:
				"Commit review metadata is only valid when leaving alignment human-review directly to next-task or finish.",
		});
	});

	it("rejects commit hashes for create intents to avoid duplicate-commit ambiguity", () => {
		const runtime = createWorkflowRuntime();
		moveToAlignmentHumanReview(runtime);

		const result = normalizeWorkflowTransitionEvent(runtime, {
			state: "next-task",
			commitIntent: "create",
			commitHash: "abc123",
		});

		assert.deepEqual(result, {
			ok: false,
			error: "commitHash can only be sent when commitIntent is existing.",
		});
	});
});
