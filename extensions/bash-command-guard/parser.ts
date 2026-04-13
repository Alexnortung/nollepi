export function tokenizeCommand(command: string) {
	const tokens: string[] = [];
	let current = "";
	let quote: string | null = null;
	let escaped = false;

	for (const ch of command.trim()) {
		if (escaped) {
			current += ch;
			escaped = false;
			continue;
		}

		if (ch === "\\") {
			escaped = true;
			continue;
		}

		if (quote) {
			if (ch === quote) {
				quote = null;
			} else {
				current += ch;
			}
			continue;
		}

		if (ch === '"' || ch === "'") {
			quote = ch;
			continue;
		}

		if (/\s/.test(ch)) {
			if (current) {
				tokens.push(current);
				current = "";
			}
			continue;
		}

		current += ch;
	}

	if (escaped) current += "\\";
	if (current) tokens.push(current);
	return tokens;
}

function splitTopLevel(command: string, separators: string[]) {
	const segments: string[] = [];
	let current = "";
	let quote: string | null = null;
	let escaped = false;
	let parenDepth = 0;

	for (let i = 0; i < command.length; i++) {
		const ch = command[i];
		const next = command[i + 1];

		if (escaped) {
			current += ch;
			escaped = false;
			continue;
		}

		if (ch === "\\") {
			current += ch;
			escaped = true;
			continue;
		}

		if (quote) {
			current += ch;
			if (ch === quote) quote = null;
			continue;
		}

		if (ch === '"' || ch === "'") {
			quote = ch;
			current += ch;
			continue;
		}

		if (ch === "(") {
			parenDepth += 1;
			current += ch;
			continue;
		}

		if (ch === ")") {
			parenDepth = Math.max(0, parenDepth - 1);
			current += ch;
			continue;
		}

		if (parenDepth === 0) {
			const twoChar = `${ch}${next ?? ""}`;
			const matched = separators.find((separator) => separator === twoChar || separator === ch);
			if (matched) {
				if (current.trim()) segments.push(current.trim());
				current = "";
				if (matched.length === 2) i += 1;
				continue;
			}
		}

		current += ch;
	}

	if (current.trim()) segments.push(current.trim());
	return segments;
}

export function splitCommandSegments(command: string) {
	return splitTopLevel(command, ["&&", "||", "|&", "|", ";"]);
}

function isRedirectionToken(token: string) {
	return /^(?:\d+)?(?:>>?|&>|<)$/.test(token) || /^(?:\d+)?(?:>>?|&>|<).+/.test(token);
}

function isFdDuplicationToken(token: string) {
	return /^\d?>&\d+$/.test(token) || /^&>\d+$/.test(token);
}

export function extractRedirectionTargets(command: string) {
	const tokens = tokenizeCommand(command);
	const targets: string[] = [];

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (!isRedirectionToken(token)) continue;
		if (isFdDuplicationToken(token)) continue;

		const match = token.match(/^(?:\d+)?(>>?|&>|<)(.+)$/);
		if (match?.[2]) {
			if (!match[2].startsWith("&")) targets.push(match[2]);
			continue;
		}

		const next = tokens[i + 1];
		if (next && !isRedirectionToken(next) && !next.startsWith("&")) {
			targets.push(next);
			i += 1;
		}
	}

	return targets;
}
