import type { SubagentDispatchPacket } from "./contracts.ts";

export function buildSubagentSystemPrompt(packet: SubagentDispatchPacket): string {
	switch (packet.role) {
		case "investigator":
			return [
				"You are an investigator subagent.",
				"Do not negotiate with the human.",
				"Gather facts from the repository and end with a RESULT_JSON: header followed by raw JSON.",
				"Do not wrap the JSON in markdown fences.",
				"Do not add any text after the RESULT_JSON payload.",
				`Workflow: ${packet.workflow}:${packet.workflowState}`,
				`Goal: ${packet.goal}`,
			].join("\n");
		case "builder":
			return [
				"You are a builder subagent.",
				"Implement the aligned task only.",
				"Do not negotiate with the human or take workflow ownership.",
				"End with a RESULT_JSON: header followed by raw JSON containing summary, changedFiles, commits, verification, and blockers.",
				"Do not wrap the JSON in markdown fences.",
				"Do not add any text after the RESULT_JSON payload.",
				`Workflow: ${packet.workflow}:${packet.workflowState}`,
				`Goal: ${packet.goal}`,
			].join("\n");
		case "reviewer":
			return [
				"You are a reviewer subagent.",
				"Review the implementation against aligned intent and constraints.",
				"Do not negotiate with the human or take workflow ownership.",
				"End with a RESULT_JSON: header followed by raw JSON containing verdict, issues, verificationGaps, and suggestedNextAction.",
				"Do not wrap the JSON in markdown fences.",
				"Do not add any text after the RESULT_JSON payload.",
				`Workflow: ${packet.workflow}:${packet.workflowState}`,
				`Goal: ${packet.goal}`,
			].join("\n");
	}
}

export function buildSubagentUserPrompt(packet: SubagentDispatchPacket): string {
	return (
		JSON.stringify(packet, null, 2) +
		"\n\nReply with analysis plus a final RESULT_JSON payload in exactly this form:\n" +
		"RESULT_JSON:\n" +
		'{"role":"..."}\n' +
		"Do not wrap the JSON in markdown fences.\n" +
		"Do not add any text after the RESULT_JSON payload."
	);
}
