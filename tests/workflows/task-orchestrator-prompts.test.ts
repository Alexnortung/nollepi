import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTaskOrchestratorSystemPrompt, buildTaskOrchestratorUserPrompt } from "../../extensions/workflows/task-orchestrator/prompts.ts";
import type { TaskOrchestratorPacket } from "../../extensions/workflows/task-orchestrator/packet-builder.ts";

const packet: TaskOrchestratorPacket = {
	workflow: "alignment",
	workflowState: "task-execution",
	runId: "run-1",
	task: {
		id: "01-task",
		summary: "Implement thing",
		description: "Do it",
		status: "in-progress",
	},
	alignedContext: {
		objective: ["Implement thing"],
		scope: ["This task only"],
		constraints: ["Keep ownership clear"],
		approach: ["Use a task orchestrator"],
		domainLanguage: ["Task orchestrator"],
	},
	priorTaskSummaries: [],
	specialistContext: {
		activeRuns: [],
		investigatorFindings: [],
	},
};

describe("task orchestrator prompts", () => {
	it("system prompt instructs direct specialist dispatch requests", () => {
		const prompt = buildTaskOrchestratorSystemPrompt(packet);
		assert.match(prompt, /dispatchRequests/i);
		assert.match(prompt, /execute those specialist dispatches on your behalf/i);
		assert.match(prompt, /Do not ask the high-level orchestrator to dispatch/i);
	});

	it("user prompt includes packet and human message", () => {
		const prompt = buildTaskOrchestratorUserPrompt(packet, "Please inspect the repo first.");
		assert.match(prompt, /Please inspect the repo first\./i);
		assert.match(prompt, /Implement thing/i);
	});
});
