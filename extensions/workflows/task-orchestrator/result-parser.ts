import type { TaskOrchestratorResult } from "../state/task-orchestrator-state.ts";

function extractBalancedJsonObject(text: string): string | undefined {
	const start = text.indexOf("{");
	if (start === -1) return undefined;

	let depth = 0;
	let inString = false;
	let escaped = false;

	for (let i = start; i < text.length; i += 1) {
		const char = text[i];
		if (escaped) {
			escaped = false;
			continue;
		}
		if (char === "\\") {
			escaped = true;
			continue;
		}
		if (char === '"') {
			inString = !inString;
			continue;
		}
		if (inString) continue;
		if (char === "{") depth += 1;
		if (char === "}") {
			depth -= 1;
			if (depth === 0) return text.slice(start, i + 1);
		}
	}

	return undefined;
}

function extractPayload(text: string): { payload: string; displayText: string } | undefined {
	const headerMatches = [...text.matchAll(/(?:^|\n)TASK_ORCHESTRATOR_JSON:?[ \t]*(?=\n|$)/g)];
	const lastHeader = headerMatches.at(-1);
	if (!lastHeader || lastHeader.index === undefined) return undefined;

	const displayText = text.slice(0, lastHeader.index).trim();
	let remainder = text.slice(lastHeader.index + lastHeader[0].length).trimStart();
	if (remainder.startsWith("```")) {
		const firstNewline = remainder.indexOf("\n");
		if (firstNewline === -1) return undefined;
		remainder = remainder.slice(firstNewline + 1);
	}
	const payload = extractBalancedJsonObject(remainder);
	if (!payload) return undefined;
	return { payload, displayText };
}

function isValidResult(value: unknown): value is TaskOrchestratorResult {
	if (!value || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	if (record.status !== "continue" && record.status !== "handoff") return false;
	return typeof record.summary === "string";
}

export function parseTaskOrchestratorResult(text: string): { result: TaskOrchestratorResult; displayText: string } {
	const extracted = extractPayload(text);
	if (!extracted) throw new Error("Missing TASK_ORCHESTRATOR_JSON block in task orchestrator output.");
	const parsed: unknown = JSON.parse(extracted.payload);
	if (!isValidResult(parsed)) throw new Error("Invalid task orchestrator result payload.");
	return { result: parsed, displayText: extracted.displayText };
}
