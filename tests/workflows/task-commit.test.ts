import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTaskCommit } from "../../extensions/workflows/tools/task-commit.ts";
import { TaskState } from "../../extensions/workflows/state/task-state.ts";

describe("task_commit", () => {
	it("records commit hash on task", () => {
		const state = new TaskState();
		state.addTask({
			summary: "Update domain types",
			description: "Task description",
			alignmentNeeded: true,
		});

		applyTaskCommit(state, {
			taskId: "01-update-domain-types",
			commitHash: "abc123",
			status: "committed",
		});

		assert.deepEqual(state.tasks[0].commitHashes, ["abc123"]);
		assert.equal(state.tasks[0].status, "committed");
	});
});
