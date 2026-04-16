import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	createTaskRuntimeState,
	addTask,
	updateTask,
	splitTask,
	mergeTasks,
	addStep,
	updateStep,
	completeStep,
	recordTaskCommit,
	selectCurrentTask,
	getActiveTaskContext,
} from "../../extensions/workflows/state/task-state.ts";

describe("task state", () => {
	it("adds first task with stable ordering id", () => {
		const state = createTaskRuntimeState();
		const next = addTask(state, {
			summary: "Update domain types",
			description: "Create commit-worthy domain type update",
			alignmentNeeded: true,
		});

		assert.equal(next.tasks.length, 1);
		assert.equal(next.tasks[0].id, "01-update-domain-types");
		assert.equal(next.tasks[0].status, "proposed");
		assert.equal(next.currentTaskId, "01-update-domain-types");
	});

	it("adds second task with incremented ordering id", () => {
		let state = createTaskRuntimeState();
		state = addTask(state, {
			summary: "Update domain types",
			description: "Create commit-worthy domain type update",
			alignmentNeeded: true,
		});
		state = addTask(state, {
			summary: "Migrate button usage",
			description: "Move callers to new type contract",
			alignmentNeeded: false,
		});

		assert.equal(state.tasks[1].id, "02-migrate-button-usage");
	});

	it("updates task fields without dropping steps or commits", () => {
		let state = createTaskRuntimeState();
		state = addTask(state, {
			summary: "Update domain types",
			description: "Old description",
			alignmentNeeded: true,
		});
		state = addStep(state, "01-update-domain-types", {
			summary: "Update type",
			description: "Change type",
			hasArtifact: false,
		});
		state = recordTaskCommit(state, "01-update-domain-types", "abc123");

		state = updateTask(state, "01-update-domain-types", {
			description: "New description",
			status: "approved",
		});

		assert.equal(state.tasks[0].description, "New description");
		assert.equal(state.tasks[0].status, "approved");
		assert.equal(state.tasks[0].steps.length, 1);
		assert.deepEqual(state.tasks[0].commitHashes, ["abc123"]);
	});

	it("splits one task into two replacement tasks", () => {
		let state = createTaskRuntimeState();
		state = addTask(state, {
			summary: "Do both things",
			description: "Too broad",
			alignmentNeeded: true,
		});

		state = splitTask(state, "01-do-both-things", [
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
		let state = createTaskRuntimeState();
		state = addTask(state, {
			summary: "Update domain types",
			description: "Part one",
			alignmentNeeded: true,
		});
		state = addTask(state, {
			summary: "Migrate button usage",
			description: "Part two",
			alignmentNeeded: false,
		});

		state = mergeTasks(state, ["01-update-domain-types", "02-migrate-button-usage"], {
			summary: "Update button type system",
			description: "Combined task",
			alignmentNeeded: true,
		});

		assert.equal(state.tasks.length, 1);
		assert.equal(state.tasks[0].id, "01-update-button-type-system");
		assert.equal(state.tasks[0].alignmentNeeded, true);
	});

	it("adds and completes steps", () => {
		let state = createTaskRuntimeState();
		state = addTask(state, {
			summary: "Update domain types",
			description: "Task description",
			alignmentNeeded: true,
		});

		state = addStep(state, "01-update-domain-types", {
			summary: "Change exported types",
			description: "Update exported types and callers",
			hasArtifact: false,
		});

		assert.equal(state.tasks[0].steps[0].id, "step-1");
		assert.equal(state.tasks[0].steps[0].status, "pending");
		assert.equal(state.currentStepId, "step-1");

		state = completeStep(state, "01-update-domain-types", "step-1");
		assert.equal(state.tasks[0].steps[0].status, "done");
	});

	it("records unique commit hashes only once", () => {
		let state = createTaskRuntimeState();
		state = addTask(state, {
			summary: "Update domain types",
			description: "Task description",
			alignmentNeeded: true,
		});

		state = recordTaskCommit(state, "01-update-domain-types", "abc123");
		state = recordTaskCommit(state, "01-update-domain-types", "abc123");

		assert.deepEqual(state.tasks[0].commitHashes, ["abc123"]);
	});

	it("selects current task and exposes active task context", () => {
		let state = createTaskRuntimeState();
		state = addTask(state, {
			summary: "One",
			description: "One",
			alignmentNeeded: true,
		});
		state = addTask(state, {
			summary: "Two",
			description: "Two",
			alignmentNeeded: true,
		});
		state = addStep(state, "02-two", {
			summary: "Two first step",
			description: "Step description",
			hasArtifact: false,
		});

		state = selectCurrentTask(state, "02-two");
		const active = getActiveTaskContext(state);

		assert.equal(state.currentTaskId, "02-two");
		assert.equal(active.currentTask?.id, "02-two");
		assert.equal(active.currentStep?.id, "step-1");
	});
});
