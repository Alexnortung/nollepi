import { tokenizeCommand, splitCommandSegments, extractRedirectionTargets } from "./parser";

export { splitCommandSegments, extractRedirectionTargets };

function normalizeTemplateToken(token: string) {
	return token.trim();
}

export function normalizeCommand(command: string) {
	return tokenizeCommand(command).join(" ");
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
