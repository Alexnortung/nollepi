import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { loadPathAllowlist, canonicalizePath, matchesAllowlist } from "./path-guard";
import { loadCommandAllowlist, saveCommandAllowlist } from "./bash-command-guard/allowlist";
import { choosePrefixSpan, evaluateCommandPolicy } from "./bash-command-guard/engine";
import { extractRedirectionTargets } from "./bash-command-guard/parser";

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return undefined;

		const command = typeof event.input.command === "string" ? event.input.command : "";
		const policy = await evaluateCommandPolicy(command, {
			cwd: ctx.cwd,
			allowlist: await loadCommandAllowlist(),
		});
		const targets = extractRedirectionTargets(command);
		const pathAllowlist = await loadPathAllowlist();
		const blockedTargets: string[] = [];
		for (const target of targets) {
			const absolute = await canonicalizePath(target);
			if (!matchesAllowlist(pathAllowlist, absolute)) blockedTargets.push(absolute);
		}

		if (policy.allowed && blockedTargets.length === 0) return undefined;
		if (!ctx.hasUI) return { block: true, reason: "Blocked by user" };

		for (const segment of policy.segments) {
			if (segment.allowed) continue;

			const choice = await ctx.ui.select(`Allow bash command segment?\n\n${segment.command}`, [
				"Deny",
				"Allow once",
				"Always allow exact command",
				"Always allow prefix",
			]);

			if (choice === "Always allow exact command") {
				await saveCommandAllowlist({ exact: [segment.normalizedCommand] });
				continue;
			}

			if (choice === "Always allow prefix") {
				const prefix = await choosePrefixSpan(ctx.ui, segment.normalizedTokens);
				await saveCommandAllowlist({ prefixes: [prefix] });
				continue;
			}

			if (choice !== "Allow once") return { block: true, reason: "Blocked by user" };
		}

		if (blockedTargets.length > 0) return { block: true, reason: "Blocked by user" };
		return undefined;
	});
}
