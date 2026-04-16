import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTaskAction } from "../../extensions/workflows/tools/task-manage.ts";
import { TaskState } from "../../extensions/workflows/state/task-state.ts";

describe("task_manage", () => {
	it("creates task", () => {
		const state = new TaskState();
		applyTaskAction(state, {
			action: "create",
			summary: "Update domain types",
			description: "Commit-worthy change",
			alignmentNeeded: true,
		});
		assert.equal(state.tasks.length, 1);
	});

	it("approves task", () => {
		const state = new TaskState();
		applyTaskAction(state, {
			action: "create",
			summary: "Update domain types",
			description: "Commit-worthy change",
			alignmentNeeded: true,
		});
		applyTaskAction(state, {
			action: "update",
			taskId: "01-update-domain-types",
			status: "approved",
		});
		assert.equal(state.tasks[0].status, "approved");
	});

	it("splits task", () => {
		const state = new TaskState();
		applyTaskAction(state, {
			action: "create",
			summary: "Do both",
			description: "Too broad",
			alignmentNeeded: true,
		});
		applyTaskAction(state, {
			action: "split",
			taskId: "01-do-both",
			replacements: [
				{ summary: "Part one", description: "One", alignmentNeeded: true },
				{ summary: "Part two", description: "Two", alignmentNeeded: true },
			],
		});
		assert.equal(state.tasks.length, 2);
	});

	it("merges tasks", () => {
		const state = new TaskState();
		applyTaskAction(state, {
			action: "create",
			summary: "Part one",
			description: "One",
			alignmentNeeded: true,
		});
		applyTaskAction(state, {
			action: "create",
			summary: "Part two",
			description: "Two",
			alignmentNeeded: true,
		});
		applyTaskAction(state, {
			action: "merge",
			taskIds: ["01-part-one", "02-part-two"],
			summary: "Combined",
			description: "Combined task",
			alignmentNeeded: true,
		});
		assert.equal(state.tasks.length, 1);
	});
});
