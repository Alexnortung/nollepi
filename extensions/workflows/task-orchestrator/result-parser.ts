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

function getDispatchRequestValidationError(value: unknown): string | undefined {
	if (!value || typeof value !== "object") return "Dispatch requests must be objects.";
	const record = value as Record<string, unknown>;
	if (record.role !== "investigator" && record.role !== "builder" && record.role !== "reviewer") {
		return "Dispatch requests must use role investigator, builder, or reviewer.";
	}
	if (typeof record.goal !== "string" || typeof record.successTarget !== "string") {
		return "Dispatch requests must include goal and successTarget strings.";
	}
	if (record.role === "builder" && (!Array.isArray(record.doneCriteria) || !record.doneCriteria.every((item) => typeof item === "string"))) {
		return "Builder dispatch requests must include doneCriteria: string[].";
	}
	return undefined;
}

function getResultValidationError(value: unknown): string | undefined {
	if (!value || typeof value !== "object") return "Result payload must be an object.";
	const record = value as Record<string, unknown>;
	if (record.status !== "continue" && record.status !== "handoff") return "Result payload must include status=continue or status=handoff.";
	if (typeof record.summary !== "string") return "Result payload must include a summary string.";
	if (record.dispatchRequests !== undefined) {
		if (!Array.isArray(record.dispatchRequests)) return "dispatchRequests must be an array when provided.";
		for (const request of record.dispatchRequests) {
			const error = getDispatchRequestValidationError(request);
			if (error) return error;
		}
	}
	return undefined;
}

export function parseTaskOrchestratorResult(text: string): { result: TaskOrchestratorResult; displayText: string } {
	const extracted = extractPayload(text);
	if (!extracted) throw new Error("Missing TASK_ORCHESTRATOR_JSON block in task orchestrator output.");
	const parsed: unknown = JSON.parse(extracted.payload);
	const validationError = getResultValidationError(parsed);
	if (validationError) throw new Error(validationError);
	return { result: parsed as TaskOrchestratorResult, displayText: extracted.displayText };
}
