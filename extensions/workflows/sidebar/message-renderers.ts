// Custom message renderers for subagent messages.

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Box, Text } from "@mariozechner/pi-tui";
import {
	renderSubagentResultText,
	renderSubagentSummaryText,
	type SubagentResultSummary,
} from "./subagent-widget.ts";

interface SubagentSummaryDetails {
	runId: number;
	role: string;
	error?: string;
}

interface SubagentResultDetails {
	runId: number;
	role: string;
	result: {
		role: string;
		verdict?: string;
		findings?: unknown[];
		issues?: unknown[];
		verificationGaps?: string[];
		suggestedNextAction?: string;
	};
}

export function registerSubagentMessageRenderers(pi: ExtensionAPI): void {
	pi.registerMessageRenderer<SubagentSummaryDetails>("workflow-subagent-summary", (message, _options, theme) => {
		const details = message.details;
		if (!details) return new Text(message.content);

		const lines = renderSubagentSummaryText(details.role, details.runId, details.error);
		const box = new Box(1, 0, (t) => theme.bg("customMessageBg", t));
		box.addChild(new Text(lines.map((l, i) => i === 0 ? theme.bold(l) : theme.fg("error", l)).join("\n")));
		return box;
	});

	pi.registerMessageRenderer<SubagentResultDetails>("workflow-subagent-result", (message, options, theme) => {
		const details = message.details;
		if (!details?.result) return undefined;

		const result = details.result;
		const summary: SubagentResultSummary = {
			role: details.role,
			verdict: result.verdict,
			findingsCount: result.findings?.length ?? 0,
			issuesCount: result.issues?.length ?? 0,
			verificationGapsCount: result.verificationGaps?.length ?? 0,
			suggestedNextAction: result.suggestedNextAction,
		};

		const lines = renderSubagentResultText(details.runId, summary, options.expanded);
		const verdictColor = result.verdict === "pass" ? "success" : result.verdict === "fail" ? "error" : "muted";

		const styledLines = lines.map((line, i) => {
			if (i === 0) return theme.bold(line);
			if (line.includes("Verdict:")) return `  Verdict: ${theme.fg(verdictColor, result.verdict?.toUpperCase() ?? "")}`;
			if (line.includes("issue(s)")) return theme.fg("warning", line);
			if (line.includes("finding(s)")) return theme.fg("accent", line);
			if (line.includes("verification gap(s)")) return theme.fg("muted", line);
			return theme.fg("dim", line);
		});

		const box = new Box(1, 0, (t) => theme.bg("customMessageBg", t));
		box.addChild(new Text(styledLines.join("\n")));
		return box;
	});
}
