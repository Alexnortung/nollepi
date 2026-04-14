import type { ExtensionAPI, BashToolCallEvent } from "@mariozechner/pi-coding-agent";
import { loadPathAllowlist, canonicalizePath, getPathAllowlistStore, matchesAllowlist, promptPathAccess } from "./path-guard";
import { loadCommandAllowlist, saveCommandAllowlist } from "./bash-command-guard/allowlist";
import { choosePrefixSpan, evaluateCommandPolicy } from "./bash-command-guard/engine";
import { extractRedirectionTargets } from "./bash-command-guard/policy";

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return undefined;
		const { input } = event as BashToolCallEvent;

		const command = input.command;
		const policy = await evaluateCommandPolicy(command, {
			cwd: ctx.cwd,
			allowlist: await loadCommandAllowlist(),
		});
		const pathAllowlistStore = getPathAllowlistStore();
		let allTargetsAllowed = true;
		for (const segment of policy.segments) {
			const pathAllowlist = await loadPathAllowlist();
			for (const target of extractRedirectionTargets(segment.command)) {
				const absolute = await canonicalizePath(target);
				if (!matchesAllowlist(pathAllowlist, absolute)) {
					allTargetsAllowed = false;
					break;
				}
			}
			if (!allTargetsAllowed) break;
		}

		if (policy.allowed && allTargetsAllowed) return undefined;
		if (!ctx.hasUI) return { block: true, reason: "Blocked by user" };

		for (const segment of policy.segments) {
			if (!segment.allowed) {
				const choice = await ctx.ui.select(`Allow bash command segment?\n\n${segment.command}`, [
					"Deny",
					"Allow once",
					"Always allow exact command",
					"Always allow prefix",
				]);

				if (choice === "Always allow exact command") {
					await saveCommandAllowlist({ exact: [segment.normalizedCommand] });
				} else if (choice === "Always allow prefix") {
					const prefix = await choosePrefixSpan(ctx.ui, segment.normalizedTokens);
					await saveCommandAllowlist({ prefixes: [prefix] });
				} else if (choice !== "Allow once") {
					return { block: true, reason: "Blocked by user" };
				}
			}

			for (const target of extractRedirectionTargets(segment.command)) {
				const absolute = await canonicalizePath(target);
				const pathAllowlist = await loadPathAllowlist();
				if (matchesAllowlist(pathAllowlist, absolute)) continue;
				const allowed = await promptPathAccess(pathAllowlistStore, ctx.ui, absolute);
				if (!allowed) return { block: true, reason: "Blocked by user" };
			}
		}

		return undefined;
	});
}
