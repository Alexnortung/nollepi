import fs from "node:fs/promises";
import path from "node:path";
import { renderTaskMarkdown, renderWorkflowMarkdown } from "./markdown";
import type { WorkflowRunSummary } from "./types";

export async function createWorkflowArtifacts(input: {
	runDirectory: string;
	workflow: string;
	title: string;
	tasks: Array<{ id: string; title: string; summary: string }>;
}) {
	await fs.mkdir(path.join(input.runDirectory, "tasks"), { recursive: true });

	for (const task of input.tasks) {
		const taskDirectory = path.join(input.runDirectory, "tasks", task.id);
		await fs.mkdir(taskDirectory, { recursive: true });
		await fs.writeFile(path.join(taskDirectory, "task.md"), renderTaskMarkdown(task), "utf8");
	}

	await fs.writeFile(
		path.join(input.runDirectory, "workflow.md"),
		renderWorkflowMarkdown({ title: input.title, workflow: input.workflow, state: "intake", tasks: input.tasks }),
		"utf8",
	);
}

export async function deriveWorkflowSummaryFromArtifacts(runDirectory: string): Promise<WorkflowRunSummary> {
	const workflowMd = await fs.readFile(path.join(runDirectory, "workflow.md"), "utf8");
	const workflow = workflowMd.match(/- Workflow: (.+)/)?.[1]?.trim() as WorkflowRunSummary["workflow"] | undefined;
	const state = workflowMd.match(/- State: (.+)/)?.[1]?.trim() ?? "idle";
	const done = state === "finish" || state === "wrap-up";
	return {
		workflow: workflow ?? "base",
		runDirectory,
		state,
		done,
	};
}

export async function syncTaskCommits(runDirectory: string, taskId: string, commits: string[]) {
	const workflowFile = path.join(runDirectory, "workflow.md");
	const taskFile = path.join(runDirectory, "tasks", taskId, "task.md");

	const [workflowMd, taskMd] = await Promise.all([
		fs.readFile(workflowFile, "utf8"),
		fs.readFile(taskFile, "utf8"),
	]);

	const nextWorkflowMd = workflowMd.replace(
		new RegExp(`(ID: ${taskId}\\n  - Summary: .*\\n  - Path: tasks/${taskId}/task.md\\n  - Commits: ).*`),
		`$1${commits.join(", ")}`,
	);
	const nextTaskMd = taskMd.replace(/- Commits: .*/, `- Commits: ${commits.join(", ")}`);

	await Promise.all([fs.writeFile(workflowFile, nextWorkflowMd, "utf8"), fs.writeFile(taskFile, nextTaskMd, "utf8")]);
}
