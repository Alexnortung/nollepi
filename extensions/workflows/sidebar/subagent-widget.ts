// Subagent widget renderer — pure rendering logic producing themed string[] lines.
// No pi-tui imports. The caller wraps these in TUI components via setWidget factory.

export interface SubagentWidgetRun {
	id: number;
	role: string;
	status: string;
	goal: string;
	taskPreview: string;
	elapsedSeconds: number;
	toolCalls: number;
	lastOutputLine: string;
}

export interface SubagentWidgetTaskOrchestrator {
	status: string;
	taskPreview: string;
	elapsedSeconds: number;
	turnCount: number;
	lastOutputLine: string;
}

export interface WidgetTheme {
	fg(color: string, text: string): string;
	bold(text: string): string;
}

const STATUS_ICONS: Record<string, string> = {
	running: "●",
	done: "✓",
	error: "✗",
};

const STATUS_COLORS: Record<string, string> = {
	running: "accent",
	done: "success",
	error: "error",
};

const ROLE_LABELS: Record<string, string> = {
	investigator: "🔍 Investigator",
	builder: "🔨 Builder",
	reviewer: "📋 Reviewer",
};

const TASK_ORCHESTRATOR_ICONS: Record<string, string> = {
	running: "●",
	waiting: "◌",
	error: "✗",
	closed: "✓",
};

const TASK_ORCHESTRATOR_COLORS: Record<string, string> = {
	running: "accent",
	waiting: "warning",
	error: "error",
	closed: "success",
};

function truncate(text: string, maxWidth: number): string {
	if (text.length <= maxWidth) return text;
	return text.slice(0, maxWidth - 1) + "…";
}

export function extractLastOutputLine(outputText: string): string {
	const lines = outputText.trim().split("\n");
	return (lines[lines.length - 1] ?? "").trim();
}

export function renderSubagentCardLines(run: SubagentWidgetRun, theme: WidgetTheme): string[] {
	const icon = STATUS_ICONS[run.status] ?? "?";
	const color = STATUS_COLORS[run.status] ?? "muted";
	const roleLabel = ROLE_LABELS[run.role] ?? run.role;

	const lines: string[] = [];
	lines.push(`${theme.fg(color, icon)} ${theme.bold(roleLabel)} ${theme.fg("muted", `#${run.id}`)}`);
	lines.push(`  ${theme.fg(color, run.status)} · ${run.elapsedSeconds}s · ${run.toolCalls} tool${run.toolCalls === 1 ? "" : "s"}`);
	lines.push(`  ${theme.fg("dim", truncate(run.goal, 60))}`);

	if (run.lastOutputLine) {
		lines.push(`  ${theme.fg("muted", "▸ " + truncate(run.lastOutputLine, 55))}`);
	}

	return lines;
}

export function renderTaskOrchestratorCardLines(to: SubagentWidgetTaskOrchestrator, theme: WidgetTheme): string[] {
	const icon = TASK_ORCHESTRATOR_ICONS[to.status] ?? "?";
	const color = TASK_ORCHESTRATOR_COLORS[to.status] ?? "muted";

	const lines: string[] = [];
	lines.push(`${theme.fg(color, icon)} ${theme.bold("🤖 Task Orchestrator")}`);
	lines.push(`  ${theme.fg(color, to.status)} · ${to.elapsedSeconds}s · ${to.turnCount} turn${to.turnCount === 1 ? "" : "s"}`);
	lines.push(`  ${theme.fg("dim", truncate(to.taskPreview, 60))}`);

	if (to.lastOutputLine) {
		lines.push(`  ${theme.fg("muted", "▸ " + truncate(to.lastOutputLine, 55))}`);
	}

	return lines;
}

export function getVisibleSubagentRuns(runs: SubagentWidgetRun[]): SubagentWidgetRun[] {
	const activeRuns = runs.filter((r) => r.status === "running");
	const recentDone = runs.filter((r) => r.status !== "running").slice(-3);
	return [...recentDone, ...activeRuns];
}

export function isTaskOrchestratorVisible(to: SubagentWidgetTaskOrchestrator | undefined): boolean {
	return !!to && to.status !== "closed";
}

export function renderDispatchCallText(role: string, goal: string): string[] {
	const label = ROLE_LABELS[role] ?? role;
	const goalPreview = goal.length > 80 ? goal.slice(0, 79) + "…" : goal;
	return [`${label} dispatching…`, goalPreview];
}

export function renderDispatchResultText(role: string, runId: number): string {
	const label = ROLE_LABELS[role] ?? role;
	return `${label} #${runId} dispatched in background.`;
}

export function renderSubagentSummaryText(role: string, runId: number, error?: string): string[] {
	const label = ROLE_LABELS[role] ?? role;
	const icon = error ? "✗" : "✓";
	const lines: string[] = [];
	lines.push(`${icon} ${label} #${runId} ${error ? "failed" : "finished"}`);
	if (error) lines.push(`  ${error}`);
	return lines;
}

export interface SubagentResultSummary {
	role: string;
	verdict?: string;
	findingsCount: number;
	issuesCount: number;
	verificationGapsCount: number;
	suggestedNextAction?: string;
}

export function renderSubagentResultText(runId: number, summary: SubagentResultSummary, expanded: boolean): string[] {
	const label = ROLE_LABELS[summary.role] ?? summary.role;
	const lines: string[] = [];
	lines.push(`${label} #${runId} — Result`);

	if (summary.verdict) {
		lines.push(`  Verdict: ${summary.verdict.toUpperCase()}`);
	}

	if (!expanded) {
		if (summary.suggestedNextAction) {
			const preview = summary.suggestedNextAction.length > 70
				? summary.suggestedNextAction.slice(0, 69) + "…"
				: summary.suggestedNextAction;
			lines.push(`  ${preview}`);
		}
	} else {
		if (summary.findingsCount > 0) lines.push(`  ${summary.findingsCount} finding(s)`);
		if (summary.issuesCount > 0) lines.push(`  ${summary.issuesCount} issue(s)`);
		if (summary.verificationGapsCount > 0) lines.push(`  ${summary.verificationGapsCount} verification gap(s)`);
		if (summary.suggestedNextAction) lines.push(`  Next: ${summary.suggestedNextAction}`);
	}

	return lines;
}
