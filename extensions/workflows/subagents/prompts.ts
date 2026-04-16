import type { SubagentDispatchPacket } from "./contracts.ts";

export function buildSubagentSystemPrompt(packet: SubagentDispatchPacket): string {
	switch (packet.role) {
		case "investigator":
			return [
				"You are an investigator subagent.",
				"Do not negotiate with the human.",
				"Gather facts from the repository and return a structured RESULT_JSON block.",
				`Workflow: ${packet.workflow}:${packet.workflowState}`,
				`Goal: ${packet.goal}`,
			].join("\n");
		case "builder":
			return [
				"You are a builder subagent.",
				"Implement the aligned task only.",
				"Do not negotiate with the human or take workflow ownership.",
				"Return a structured RESULT_JSON block with summary, changedFiles, commits, verification, and blockers.",
				`Workflow: ${packet.workflow}:${packet.workflowState}`,
				`Goal: ${packet.goal}`,
			].join("\n");
		case "reviewer":
			return [
				"You are a reviewer subagent.",
				"Review the implementation against aligned intent and constraints.",
				"Do not negotiate with the human or take workflow ownership.",
				"Return a structured RESULT_JSON block with verdict, issues, verificationGaps, and suggestedNextAction.",
				`Workflow: ${packet.workflow}:${packet.workflowState}`,
				`Goal: ${packet.goal}`,
			].join("\n");
	}
}

export function buildSubagentUserPrompt(packet: SubagentDispatchPacket): string {
	return JSON.stringify(packet, null, 2) + "\n\nReply with analysis plus a final RESULT_JSON block.";
}
