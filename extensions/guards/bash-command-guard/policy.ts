import { tokenizeCommand, splitCommandSegments as splitCommandSegmentsImpl } from "./parser";

function normalizeTemplateToken(token: string) {
	return token.trim();
}

export function normalizeCommand(command: string) {
	return tokenizeCommand(command).join(" ");
}

export function splitCommandSegments(command: string) {
	return splitCommandSegmentsImpl(command);
}

const REDIRECTION_PREFIXES = ["2>>", "2>", "&>", ">>", ">", "<"];

function parseRedirectionToken(token: string) {
	for (const prefix of REDIRECTION_PREFIXES) {
		if (!token.startsWith(prefix)) continue;
		const rest = token.slice(prefix.length);
		if (prefix === "2>" && rest.startsWith("&")) return null;
		if (prefix === "&>" && rest.startsWith("&")) return null;
		return { prefix, rest };
	}
	return null;
}

export function extractRedirectionTargets(command: string) {
	const tokens = tokenizeCommand(command);
	const targets: string[] = [];

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		const parsed = parseRedirectionToken(token);
		if (!parsed) continue;

		if (parsed.rest) {
			if (!parsed.rest.startsWith("&")) targets.push(parsed.rest);
			continue;
		}

		const next = tokens[i + 1];
		if (next && !parseRedirectionToken(next) && !next.startsWith("&")) {
			targets.push(next);
			i += 1;
		}
	}

	return targets;
}

export function matchesExact(command: string, exact: string) {
	return normalizeCommand(command) === normalizeCommand(exact);
}

export function matchesPrefix(command: string, prefix: string) {
	return normalizeCommand(command).startsWith(normalizeCommand(prefix));
}

function patternTokenToRegex(token: string) {
	const escaped = token
		.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
		.replace(/\\\{value\\\}/g, "(.+)")
		.replace(/\\\{args\\\}/g, "(.*)");
	return new RegExp(`^${escaped}$`);
}

export function matchesTemplate(command: string, template: string) {
	const commandTokens = tokenizeCommand(command);
	const templateTokens = tokenizeCommand(template).map(normalizeTemplateToken);

	let i = 0;
	let j = 0;

	while (i < templateTokens.length) {
		const token = templateTokens[i];
		if (token === "{args}") {
			return true;
		}

		const current = commandTokens[j];
		if (current === undefined) return false;

		if (token.includes("{value}") || token.includes("{args}")) {
			if (!patternTokenToRegex(token).test(current)) return false;
			i += 1;
			j += 1;
			continue;
		}

		if (token !== current) return false;
		i += 1;
		j += 1;
	}

	return j === commandTokens.length;
}
