function slugify(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/--+/g, "-");
}

export function buildRunId(workflow: string, title: string, date = new Date(), ordinal = 1): string {
	const yyyy = date.getUTCFullYear();
	const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(date.getUTCDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}-${String(ordinal).padStart(2, "0")}-${workflow}-${slugify(title)}`;
}

export function getRunDir(runId: string): string {
	return `docs/.workflows/runs/${runId}`;
}

export function getWorkflowMdPath(runId: string): string {
	return `${getRunDir(runId)}/workflow.md`;
}

export function getTaskDir(runId: string, taskId: string): string {
	return `${getRunDir(runId)}/tasks/${taskId}`;
}

export function getTaskMdPath(runId: string, taskId: string): string {
	return `${getTaskDir(runId, taskId)}/task.md`;
}

export function getStepMdPath(runId: string, taskId: string, stepSlug: string): string {
	return `${getTaskDir(runId, taskId)}/${stepSlug}.md`;
}
