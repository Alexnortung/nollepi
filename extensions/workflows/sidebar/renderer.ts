// Pure sidebar renderer — no pi/typebox imports. Produces plain string[] lines.

export interface SidebarTaskStep {
	id: string;
	summary: string;
	status: string;
	isCurrent: boolean;
}

export interface SidebarTask {
	id: string;
	summary: string;
	status: string;
	isCurrent: boolean;
	steps: SidebarTaskStep[];
}

export interface SidebarAlignmentPart {
	id: string;
	summary: string;
	state: string;
}

export interface SidebarAlignmentCategory {
	name: string;
	relevance: string;
	parts: SidebarAlignmentPart[];
}

export interface SidebarAlignment {
	aligned: number;
	pending: number;
	skipped: number;
	total: number;
	categories: SidebarAlignmentCategory[];
}

export interface SidebarState {
	workflow: string;
	workflowState: string;
	runId?: string;
	tasks: SidebarTask[];
	alignment?: SidebarAlignment;
}

const TASK_ICONS: Record<string, string> = {
	"committed": "✓",
	"approved-complete": "✓",
	"in-progress": "▶",
	"review": "⏳",
	"approved": "◻",
	"proposed": "◻",
};

const STEP_ICONS: Record<string, string> = {
	"done": "✓",
	"in-progress": "▶",
	"pending": "○",
};

const ALIGNMENT_ICONS: Record<string, string> = {
	"aligned": "✓",
	"under-discussion": "…",
	"unaligned": "○",
	"skipped": "—",
	"not-relevant": "—",
};

function taskIcon(status: string): string {
	return TASK_ICONS[status] ?? "?";
}

function stepIcon(status: string): string {
	return STEP_ICONS[status] ?? "?";
}

function alignmentIcon(state: string): string {
	return ALIGNMENT_ICONS[state] ?? "?";
}

const ALIGNMENT_WORKFLOWS = new Set(["alignment", "autonomous"]);

export function renderSidebar(state: SidebarState): string[] {
	const lines: string[] = [];

	// Header
	lines.push(`⚙ ${state.workflow}:${state.workflowState}`);

	// Tasks section
	if (state.tasks.length > 0) {
		const doneCount = state.tasks.filter((t) => t.status === "committed" || t.status === "approved-complete").length;
		lines.push(`─ Tasks (${doneCount}/${state.tasks.length} done)`);

		for (const task of state.tasks) {
			const icon = taskIcon(task.status);
			const pointer = task.isCurrent ? " ←" : "";
			lines.push(`  ${icon} ${task.id} — ${task.summary}${pointer}`);

			// Show steps only for current task
			if (task.isCurrent && task.steps.length > 0) {
				for (const step of task.steps) {
					const sIcon = stepIcon(step.status);
					lines.push(`    ${sIcon} ${step.id}: ${step.summary}`);
				}
			}
		}
	}

	// Alignment section (only for alignment/autonomous workflows)
	if (ALIGNMENT_WORKFLOWS.has(state.workflow) && state.alignment && state.alignment.total > 0) {
		lines.push(`─ Alignment (${state.alignment.aligned}/${state.alignment.total})`);

		for (const cat of state.alignment.categories) {
			if (cat.relevance === "not-relevant") {
				lines.push(`  ${cat.name}: —`);
				continue;
			}
			if (cat.parts.length === 0) continue;
			const icons = cat.parts.map((p) => alignmentIcon(p.state)).join("");
			lines.push(`  ${cat.name}: ${icons}`);
		}
	}

	return lines;
}
