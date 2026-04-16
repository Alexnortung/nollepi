import type { TaskRuntimeState, WorkflowStep, WorkflowTask } from "../state/task-state.ts";

export function renderWorkflowMd(input: {
	title: string;
	workflowType: string;
	workflowState: string;
	runId: string;
	taskState: TaskRuntimeState;
}): string {
	const taskLines = input.taskState.tasks.length
		? input.taskState.tasks
				.map((task) => {
					const commits = task.commitHashes.length ? `\n  - Commits: ${task.commitHashes.join(", ")}` : "";
					return `- [${task.status}] ${task.id} — ${task.summary}${commits}`;
				})
				.join("\n")
		: "- No tasks yet";

	return [
		`# ${input.title}`,
		"",
		`- Workflow type: ${input.workflowType}`,
		`- Workflow state: ${input.workflowState}`,
		`- Run id: ${input.runId}`,
		"",
		"## Tasks",
		taskLines,
		"",
	].join("\n");
}

export function renderTaskMd(task: WorkflowTask): string {
	const steps = task.steps.length
		? task.steps
				.map(
					(step, index) =>
						`${index + 1}. [${step.status}] ${step.summary}${step.artifactPath ? ` (${step.artifactPath})` : ""}`,
				)
				.join("\n")
		: "No steps yet";

	return [
		`# ${task.summary}`,
		"",
		`- Task id: ${task.id}`,
		`- Status: ${task.status}`,
		`- Alignment needed: ${task.alignmentNeeded}`,
		`- Commits: ${task.commitHashes.join(", ") || "None"}`,
		"",
		"## Description",
		task.description,
		"",
		"## Steps",
		steps,
		"",
	].join("\n");
}

export function renderStepMd(step: WorkflowStep): string {
	return [
		`# ${step.summary}`,
		"",
		`- Step id: ${step.id}`,
		`- Status: ${step.status}`,
		"",
		"## Description",
		step.description,
		"",
	].join("\n");
}
