import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getStepMdPath, getTaskMdPath, getWorkflowMdPath } from "./paths.ts";
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

export async function writeWorkflowArtifacts(
	baseDir: string,
	input: {
		runId: string;
		title: string;
		workflowType: string;
		workflowState: string;
		taskState: TaskRuntimeState;
	},
): Promise<void> {
	const workflowPath = path.join(baseDir, getWorkflowMdPath(input.runId));
	await fs.mkdir(path.dirname(workflowPath), { recursive: true });
	await fs.writeFile(
		workflowPath,
		renderWorkflowMd({
			title: input.title,
			workflowType: input.workflowType,
			workflowState: input.workflowState,
			runId: input.runId,
			taskState: input.taskState,
		}),
		"utf8",
	);

	for (const task of input.taskState.tasks) {
		const taskPath = path.join(baseDir, getTaskMdPath(input.runId, task.id));
		await fs.mkdir(path.dirname(taskPath), { recursive: true });
		await fs.writeFile(taskPath, renderTaskMd(task), "utf8");

		for (const step of task.steps) {
			if (!step.hasArtifact || !step.artifactPath) continue;
			const stepSlug = step.artifactPath.replace(/\.md$/, "");
			const stepPath = path.join(baseDir, getStepMdPath(input.runId, task.id, stepSlug));
			await fs.writeFile(stepPath, renderStepMd(step), "utf8");
		}
	}
}
