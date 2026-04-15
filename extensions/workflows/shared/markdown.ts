export function renderWorkflowMarkdown(input: {
	title: string;
	workflow: string;
	state: string;
	tasks: Array<{ id: string; title: string; summary: string; commits?: string[] }>;
}) {
	const lines = [
		`# ${input.title}`,
		"",
		`- Workflow: ${input.workflow}`,
		`- State: ${input.state}`,
		"",
		"## Tasks",
		"",
	];

	for (const [index, task] of input.tasks.entries()) {
		lines.push(`- [ ] Task ${String(index + 1).padStart(2, "0")}: ${task.title}`);
		lines.push(`  - ID: ${task.id}`);
		lines.push(`  - Summary: ${task.summary}`);
		lines.push(`  - Path: tasks/${task.id}/task.md`);
		lines.push(`  - Commits: ${task.commits?.join(", ") ?? ""}`);
	}

	lines.push("");
	return `${lines.join("\n")}\n`;
}

export function renderTaskMarkdown(input: {
	id: string;
	title: string;
	summary: string;
	description?: string;
	steps?: Array<{ title: string; summary: string; file?: string }>;
	commits?: string[];
}) {
	const lines = [
		`# Task ${input.id.slice(0, 2)}: ${input.title}`,
		"",
		`- ID: ${input.id}`,
		`- Title: ${input.title}`,
		`- Summary: ${input.summary}`,
		`- Commits: ${input.commits?.join(", ") ?? ""}`,
		"",
		"## Description",
		"",
		input.description ?? input.summary,
		"",
		"## Steps",
		"",
	];

	for (const [index, step] of (input.steps ?? []).entries()) {
		lines.push(`${index + 1}. ${step.title}`);
		lines.push(`   - Summary: ${step.summary}`);
		if (step.file) lines.push(`   - File: ${step.file}`);
	}

	lines.push("");
	return `${lines.join("\n")}\n`;
}
