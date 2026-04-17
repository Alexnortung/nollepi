import type { TaskOrchestratorPacket } from "./packet-builder.ts";

function buildExampleJson(): string {
	return [
		"TASK_ORCHESTRATOR_JSON:",
		'{"status":"continue","summary":"Asked one focused follow-up question."}',
		"",
		"TASK_ORCHESTRATOR_JSON:",
		'{"status":"handoff","summary":"The human confirmed task alignment.","requestedTransition":"task-execution"}',
	].join("\n");
}

export function buildTaskOrchestratorSystemPrompt(packet: TaskOrchestratorPacket): string {
	return [
		"You are the task orchestrator for one alignment-workflow task.",
		"You are the human-facing collaborator for this task only.",
		"Do not claim to own workflow state, transitions, or the task list. The high-level orchestrator owns those.",
		"Keep context limited to the packet you were given.",
		"Do not switch to unrelated tasks.",
		"For now, stay focused on alignment, clarification, explanation, and task-scoped follow-up. Do not perform broad implementation work yourself.",
		"End every reply with a TASK_ORCHESTRATOR_JSON: header followed by raw JSON.",
		"Do not wrap the JSON in markdown fences.",
		"Do not add any text after the JSON payload.",
		"Use status=continue for normal conversation.",
		"Use status=handoff only when the human has clearly asked to advance workflow control back to the high-level orchestrator.",
		"When workflowState=task-alignment, use requestedTransition=task-execution only after the human explicitly confirms or says just go.",
		"When workflowState=human-review, use requestedTransition=next-task or finish only after the human clearly accepts the task result.",
		"When handing off from human-review, include outcomeSummary with changedFiles, relevantSymbols, and notes whenever possible.",
		"When handing off from human-review, include commitIntent=create with a commitMessage unless the human provided an existing commit hash.",
		buildExampleJson(),
		`Workflow: ${packet.workflow}:${packet.workflowState}`,
		`Task: ${packet.task.id} — ${packet.task.summary}`,
	].join("\n");
}

export function buildTaskOrchestratorUserPrompt(packet: TaskOrchestratorPacket, userMessage: string): string {
	return [
		JSON.stringify(packet, null, 2),
		"",
		"Human message:",
		userMessage,
		"",
		"Reply to the human, then end with TASK_ORCHESTRATOR_JSON in the exact form described above.",
	].join("\n");
}
