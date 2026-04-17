import type { SubagentResult } from "./contracts.ts";

function isSubagentResult(value: unknown): value is SubagentResult {
	if (!value || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	return record.role === "investigator" || record.role === "builder" || record.role === "reviewer";
}

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

function extractResultJsonPayload(text: string): string | undefined {
	const headerMatches = [...text.matchAll(/(?:^|\n)RESULT_JSON:?[ \t]*(?=\n|$)/g)];
	const lastHeader = headerMatches.at(-1);
	if (!lastHeader || lastHeader.index === undefined) return undefined;

	let remainder = text.slice(lastHeader.index + lastHeader[0].length).trimStart();
	if (remainder.startsWith("```")) {
		const firstNewline = remainder.indexOf("\n");
		if (firstNewline === -1) return undefined;
		remainder = remainder.slice(firstNewline + 1);
	}

	return extractBalancedJsonObject(remainder);
}

export function parseSubagentResult(text: string): SubagentResult {
	const payload = extractResultJsonPayload(text);
	if (!payload) throw new Error("Missing RESULT_JSON block in subagent output.");
	const parsed: unknown = JSON.parse(payload);
	if (!isSubagentResult(parsed)) throw new Error("Invalid subagent result payload.");
	return parsed;
}
