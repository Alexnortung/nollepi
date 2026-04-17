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

	it("closes and replaces a session when task changes", () => {
		const state = new TaskOrchestratorState();
		state.startOrReuseSession({ taskId: "01-task", taskPreview: "Task 1", sessionFile: "/tmp/one.jsonl" });
		state.closeSession();
		state.startOrReuseSession({ taskId: "02-task", taskPreview: "Task 2", sessionFile: "/tmp/two.jsonl" });
		assert.equal(state.getSession()?.taskId, "02-task");
		assert.equal(state.getSession()?.sessionFile, "/tmp/two.jsonl");
	});
});
