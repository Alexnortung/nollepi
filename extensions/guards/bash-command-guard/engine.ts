import type { CommandAllowlist, CommandPolicy } from "./types";
import { matchesExact, matchesPrefix, matchesTemplate, normalizeCommand, splitCommandSegments } from "./policy";

const SAFE_COMMANDS = ["sort", "uniq", "head", "tail", "cat", "wc"];

function isSafeCommand(command: string) {
	const normalized = normalizeCommand(command);
	return SAFE_COMMANDS.some((safe) => normalized === safe || normalized.startsWith(`${safe} `));
}

function allowSegment(segment: string, allowlist: CommandAllowlist) {
	return (
		isSafeCommand(segment) ||
		allowlist.exact.some((entry) => matchesExact(segment, entry)) ||
		allowlist.prefixes.some((entry) => matchesPrefix(segment, entry)) ||
		allowlist.templates.some((entry) => matchesTemplate(segment, entry))
	);
}

export async function evaluateCommandPolicy(
	command: string,
	input: { cwd: string; allowlist: CommandAllowlist },
): Promise<CommandPolicy> {
	const normalizedCommand = normalizeCommand(command);
	const normalizedTokens = normalizedCommand ? normalizedCommand.split(" ") : [];
	const segments = splitCommandSegments(command).map((segment) => {
		const normalizedSegment = normalizeCommand(segment);
		return {
			command: segment,
			normalizedCommand: normalizedSegment,
			normalizedTokens: normalizedSegment ? normalizedSegment.split(" ") : [],
			allowed: allowSegment(segment, input.allowlist),
		};
	});
	return {
		allowed: segments.every((segment) => segment.allowed),
		normalizedCommand,
		normalizedTokens,
		message: `Allow bash command?\n\n${command}`,
		segments,
	};
}

export async function choosePrefixSpan(ui: Pick<import("@mariozechner/pi-coding-agent").ExtensionUIContext, "select">, tokens: string[]) {
	if (!tokens.length) return "";
	const choices = tokens.map((_, index) => tokens.slice(0, index + 1).join(" "));
	const choice = await ui.select("Choose prefix span", choices);
	return choice || choices[choices.length - 1];
}
