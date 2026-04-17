import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TaskOrchestratorState } from "../../extensions/workflows/state/task-orchestrator-state.ts";

describe("TaskOrchestratorState", () => {
	it("starts a session and tracks turns", () => {
		const state = new TaskOrchestratorState();
		state.startOrReuseSession({ taskId: "01-task", taskPreview: "Task", sessionFile: "/tmp/task.jsonl" });
		state.startTurn();
		state.appendText("hello");
		state.recordToolCall();
		state.finishTurn({ status: "continue", summary: "Asked question" }, "Hello there");

		const session = state.getSession();
		assert.ok(session);
		assert.equal(session.turnCount, 1);
		assert.equal(session.status, "waiting");
		assert.equal(session.outputText, "hello");
		assert.equal(session.toolCalls, 1);
		assert.equal(session.lastDisplayText, "Hello there");
	});

	it("restores running session as waiting", () => {
		const state = TaskOrchestratorState.restore({
			session: {
				taskId: "01-task",
				taskPreview: "Task",
				sessionFile: "/tmp/task.jsonl",
				status: "running",
				startedAt: 1,
				turnCount: 2,
				toolCalls: 3,
				outputText: "partial",
			},
		});

		assert.equal(state.getSession()?.status, "waiting");
	});

	it("queues specialist follow-up messages while the task orchestrator is running", () => {
		const state = new TaskOrchestratorState();
		state.startOrReuseSession({ taskId: "01-task", taskPreview: "Task", sessionFile: "/tmp/task.jsonl" });
		state.startTurn();
		state.enqueueFollowUpMessage("specialist result one");
		state.enqueueFollowUpMessage("specialist result two");

		assert.deepEqual(state.getSession()?.queuedFollowUpMessages, ["specialist result one", "specialist result two"]);
		assert.equal(state.dequeueFollowUpMessage(), "specialist result one");
		assert.equal(state.dequeueFollowUpMessage(), "specialist result two");
		assert.equal(state.dequeueFollowUpMessage(), undefined);
	});

	it("stays open until drained after close is requested", () => {
		const state = new TaskOrchestratorState();
		state.startOrReuseSession({ taskId: "01-task", taskPreview: "Task", sessionFile: "/tmp/task.jsonl" });
		state.requestCloseAfterDrain();
		state.enqueueFollowUpMessage("late specialist result");

		assert.equal(state.closeIfDrained(0), false);
		assert.equal(state.getSession()?.status, "waiting");

		state.dequeueFollowUpMessage();
		assert.equal(state.closeIfDrained(1), false);
		assert.equal(state.getSession()?.status, "waiting");

		assert.equal(state.closeIfDrained(0), true);
		assert.equal(state.getSession()?.status, "closed");
	});

	it("restores queued follow-up messages", () => {
		const state = TaskOrchestratorState.restore({
			session: {
				taskId: "01-task",
				taskPreview: "Task",
				sessionFile: "/tmp/task.jsonl",
				status: "waiting",
				startedAt: 1,
				turnCount: 1,
				toolCalls: 0,
				outputText: "",
				queuedFollowUpMessages: ["queued result"],
			},
		});

		assert.equal(state.dequeueFollowUpMessage(), "queued result");
	});

	it("closes and replaces a session when task changes", () => {
		const state = new TaskOrchestratorState();
		state.startOrReuseSession({ taskId: "01-task", taskPreview: "Task 1", sessionFile: "/tmp/one.jsonl" });
		state.closeSession();
		state.startOrReuseSession({ taskId: "02-task", taskPreview: "Task 2", sessionFile: "/tmp/two.jsonl" });
		assert.equal(state.getSession()?.taskId, "02-task");
		assert.equal(state.getSession()?.sessionFile, "/tmp/two.jsonl");
	});
});
