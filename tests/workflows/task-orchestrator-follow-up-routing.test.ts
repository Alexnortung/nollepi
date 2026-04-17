import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldRouteSpecialistResultToTaskOrchestrator } from "../../extensions/workflows/task-orchestrator/follow-up-routing.ts";
import type { TaskOrchestratorSession } from "../../extensions/workflows/state/task-orchestrator-state.ts";

function makeSession(): TaskOrchestratorSession {
	return {
		taskId: "01-task",
		taskPreview: "Task",
		sessionFile: "/tmp/task.jsonl",
		status: "waiting",
		startedAt: 1,
		turnCount: 1,
		toolCalls: 0,
		outputText: "",
		queuedFollowUpMessages: [],
		pendingCloseAfterDrain: true,
	};
}

describe("task orchestrator follow-up routing", () => {
	it("keeps routing late specialist results while session is pending close after drain", () => {
		const session = makeSession();
		assert.equal(shouldRouteSpecialistResultToTaskOrchestrator(session, "01-task"), true);
	});

	it("does not route after session is fully closed", () => {
		const session = makeSession();
		session.status = "closed";
		assert.equal(shouldRouteSpecialistResultToTaskOrchestrator(session, "01-task"), false);
	});
});
