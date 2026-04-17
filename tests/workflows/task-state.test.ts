import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TaskState } from "../../extensions/workflows/state/task-state.ts";

describe("task state", () => {
	it("adds first task with stable ordering id", () => {
		const state = new TaskState();
		state.addTask({
			summary: "Update domain types",
			description: "Create commit-worthy domain type update",
			alignmentNeeded: true,
		});

		assert.equal(state.tasks.length, 1);
		assert.equal(state.tasks[0].id, "01-update-domain-types");
		assert.equal(state.tasks[0].status, "proposed");
		assert.equal(state.currentTaskId, "01-update-domain-types");
	});

	it("adds second task with incremented ordering id", () => {
		const state = new TaskState();
		state.addTask({
			summary: "Update domain types",
			description: "Create commit-worthy domain type update",
			alignmentNeeded: true,
		});
		state.addTask({
			summary: "Migrate button usage",
			description: "Move callers to new type contract",
			alignmentNeeded: false,
		});

		assert.equal(state.tasks[1].id, "02-migrate-button-usage");
	});

	it("updates task fields without dropping steps or commits", () => {
		const state = new TaskState();
		state.addTask({
			summary: "Update domain types",
			description: "Old description",
			alignmentNeeded: true,
		});
		state.addStep({
			taskId: "01-update-domain-types",
			summary: "Update type",
			description: "Change type",
			hasArtifact: false,
		});
		state.recordTaskCommit("01-update-domain-types", "abc123");

		state.updateTask("01-update-domain-types", {
			description: "New description",
			status: "approved",
		});

		assert.equal(state.tasks[0].description, "New description");
		assert.equal(state.tasks[0].status, "approved");
		assert.equal(state.tasks[0].steps.length, 1);
		assert.deepEqual(state.tasks[0].commitHashes, ["abc123"]);
	});

	it("splits one task into two replacement tasks", () => {
		const state = new TaskState();
		state.addTask({
			summary: "Do both things",
			description: "Too broad",
			alignmentNeeded: true,
		});

		state.splitTask("01-do-both-things", [
			{
				summary: "Update domain types",
				description: "Part one",
				alignmentNeeded: true,
			},
			{
				summary: "Migrate button usage",
				description: "Part two",
				alignmentNeeded: true,
			},
		]);

		assert.deepEqual(
			state.tasks.map((task) => task.id),
			["01-update-domain-types", "02-migrate-button-usage"],
		);
	});

	it("merges adjacent tasks into one", () => {
		const state = new TaskState();
		state.addTask({
			summary: "Update domain types",
			description: "Part one",
			alignmentNeeded: true,
		});
		state.addTask({
			summary: "Migrate button usage",
			description: "Part two",
			alignmentNeeded: false,
		});

		state.mergeTasks(["01-update-domain-types", "02-migrate-button-usage"], {
			summary: "Update button type system",
			description: "Combined task",
			alignmentNeeded: true,
		});

		assert.equal(state.tasks.length, 1);
		assert.equal(state.tasks[0].id, "01-update-button-type-system");
		assert.equal(state.tasks[0].alignmentNeeded, true);
	});

	it("adds and completes steps", () => {
		const state = new TaskState();
		state.addTask({
			summary: "Update domain types",
			description: "Task description",
			alignmentNeeded: true,
		});

		state.addStep({
			taskId: "01-update-domain-types",
			summary: "Change exported types",
			description: "Update exported types and callers",
			hasArtifact: false,
		});

		assert.equal(state.tasks[0].steps[0].id, "step-1");
		assert.equal(state.tasks[0].steps[0].status, "pending");
		assert.equal(state.currentStepId, "step-1");

		state.completeStep("01-update-domain-types", "step-1");
		assert.equal(state.tasks[0].steps[0].status, "done");
	});

	it("records unique commit hashes only once", () => {
		const state = new TaskState();
		state.addTask({
			summary: "Update domain types",
			description: "Task description",
			alignmentNeeded: true,
		});

		state.recordTaskCommit("01-update-domain-types", "abc123");
		state.recordTaskCommit("01-update-domain-types", "abc123");

		assert.deepEqual(state.tasks[0].commitHashes, ["abc123"]);
	});

	it("records a task outcome summary", () => {
		const state = new TaskState();
		state.addTask({ summary: "Build feature", description: "Desc", alignmentNeeded: true });

		state.recordTaskOutcome("01-build-feature", {
			changedFiles: ["extensions/workflows/state/task-state.ts"],
			relevantSymbols: ["TaskState.recordTaskCommit"],
			notes: ["commit hashes are deduplicated"],
		});

		const outcome = state.tasks[0].outcomeSummary;
		assert.ok(outcome !== undefined);
		assert.deepEqual(outcome.changedFiles, ["extensions/workflows/state/task-state.ts"]);
		assert.deepEqual(outcome.relevantSymbols, ["TaskState.recordTaskCommit"]);
		assert.deepEqual(outcome.notes, ["commit hashes are deduplicated"]);
	});

	it("getCompletedOutcomeSummaries returns only tasks with a recorded outcome", () => {
		const state = new TaskState();
		state.addTask({ summary: "Task one", description: "Desc", alignmentNeeded: true });
		state.addTask({ summary: "Task two", description: "Desc", alignmentNeeded: true });

		state.recordTaskOutcome("01-task-one", {
			changedFiles: ["a.ts"],
			relevantSymbols: ["FooClass"],
			notes: [],
		});

		const summaries = state.getCompletedOutcomeSummaries();
		assert.equal(summaries.length, 1);
		assert.equal(summaries[0].taskId, "01-task-one");
		assert.deepEqual(summaries[0].summary.changedFiles, ["a.ts"]);
	});

	it("selects current task and exposes active task context", () => {
		const state = new TaskState();
		state.addTask({
			summary: "One",
			description: "One",
			alignmentNeeded: true,
		});
		state.addTask({
			summary: "Two",
			description: "Two",
			alignmentNeeded: true,
		});
		state.addStep({
			taskId: "02-two",
			summary: "Two first step",
			description: "Step description",
			hasArtifact: false,
		});

		state.selectCurrentTask("02-two");
		const active = state.getActiveTaskContext();

		assert.equal(state.currentTaskId, "02-two");
		assert.equal(active.currentTask?.id, "02-two");
		assert.equal(active.currentStep?.id, "step-1");
	});
});
