import type { SubagentResult } from "./contracts.ts";

function isSubagentResult(value: unknown): value is SubagentResult {
	if (!value || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	return record.role === "investigator" || record.role === "builder" || record.role === "reviewer";
}

export function parseSubagentResult(text: string): SubagentResult {
	const match = text.match(/RESULT_JSON:\s*(\{[\s\S]+\})\s*$/);
	if (!match) throw new Error("Missing RESULT_JSON block in subagent output.");
	const parsed: unknown = JSON.parse(match[1]);
	if (!isSubagentResult(parsed)) throw new Error("Invalid subagent result payload.");
	return parsed;
}
