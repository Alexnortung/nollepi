import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { SubagentRole } from "./contracts.ts";

export interface SubagentCompletionSummaryEntry {
	runId: number;
	role: SubagentRole;
	summary: string;
	error?: string;
}

export function recordSubagentCompletionSummary(
	pi: Pick<ExtensionAPI, "appendEntry">,
	run: { id: number; role: SubagentRole },
	error?: string,
): void {
	const summary = error ? `${run.role} #${run.id} failed: ${error}` : `${run.role} #${run.id} finished.`;
	const entry: SubagentCompletionSummaryEntry = {
		runId: run.id,
		role: run.role,
		summary,
		...(error ? { error } : {}),
	};
	pi.appendEntry("workflow-subagent-summary", entry);
}
