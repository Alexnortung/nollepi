import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getStepMdPath, getTaskMdPath, getWorkflowMdPath } from "./paths.ts";
import { TaskState, type TaskStatus, type StepStatus } from "../state/task-state.ts";

const VALID_TASK_STATUSES: ReadonlySet<string> = new Set<TaskStatus>([
	"proposed",
	"approved",
	"in-progress",
	"review",
	"approved-complete",
	"committed",
]);
const VALID_STEP_STATUSES: ReadonlySet<string> = new Set<StepStatus>(["pending", "in-progress", "done"]);

function toTaskStatus(s: string): TaskStatus {
	if (VALID_TASK_STATUSES.has(s)) return s as TaskStatus;
	return "proposed";
}

function toStepStatus(s: string): StepStatus {
	if (VALID_STEP_STATUSES.has(s)) return s as StepStatus;
	return "pending";
}

export function parseWorkflowMd(markdown: string): {
	title: string;
	workflowType: string;
	workflowState: string;
	runId: string;
	tasks: Array<{
		id: string;
		status: string;
		summary: string;
		commitHashes: string[];
	}>;
} {
	const title = markdown.match(/^# (.+)$/m)?.[1]?.trim() ?? "";
	const workflowType = markdown.match(/^- Workflow type: (.+)$/m)?.[1] ?? "";
	const workflowState = markdown.match(/^- Workflow state: (.+)$/m)?.[1] ?? "";
	const runId = markdown.match(/^- Run id: (.+)$/m)?.[1] ?? "";

	const taskMatches = Array.from(markdown.matchAll(/^- \[(.+?)\] (\S+) — (.+)$/gm));
	const tasks = taskMatches.map((match, index) => {
		const blockStart = match.index ?? 0;
		const nextTaskIndex = index + 1 < taskMatches.length ? taskMatches[index + 1].index : undefined;
		const block = markdown.slice(blockStart, nextTaskIndex);
		const commitLine = block.match(/^\s*- Commits: (.+)$/m)?.[1] ?? "";
		return {
			status: match[1],
			id: match[2],
			summary: match[3],
			commitHashes: commitLine ? commitLine.split(/,\s*/) : [],
		};
	});

	return { title, workflowType, workflowState, runId, tasks };
}

export function parseTaskMd(markdown: string): {
	summary: string;
	id: string;
	status: string;
	alignmentNeeded: boolean;
	commitHashes: string[];
	description: string;
	steps: Array<{ summary: string; status: string; artifactPath?: string }>;
} {
	const summary = markdown.match(/^# (.+)$/m)?.[1]?.trim() ?? "";
	const id = markdown.match(/^- Task id: (.+)$/m)?.[1] ?? "";
	const status = markdown.match(/^- Status: (.+)$/m)?.[1] ?? "";
	const alignmentNeeded = markdown.match(/^- Alignment needed: (.+)$/m)?.[1] === "true";
	const commitHashes = (markdown.match(/^- Commits: (.+)$/m)?.[1] ?? "")
		.split(/,\s*/)
		.filter(Boolean)
		.filter((value) => value !== "None");
	const description = markdown.match(/^## Description\n([\s\S]*?)\n## Steps$/m)?.[1]?.trim() ?? "";

	const stepsHeader = markdown.match(/^## Steps\n/m);
	const stepsStart = stepsHeader?.index;
	let stepsSection = "";
	if (stepsStart !== undefined) {
		const afterHeader = markdown.slice(stepsStart + stepsHeader[0].length);
		const nextHeadingIndex = afterHeader.search(/^## /m);
		stepsSection = nextHeadingIndex === -1 ? afterHeader : afterHeader.slice(0, nextHeadingIndex);
	}
	const steps = Array.from(stepsSection.matchAll(/^\d+\. \[(.+?)\] (.+?)(?: \((.+\.md)\))?$/gm)).map((match) => ({
		status: match[1],
		summary: match[2],
		artifactPath: match[3],
	}));

	return { summary, id, status, alignmentNeeded, commitHashes, description, steps };
}

export function parseStepMd(markdown: string): { summary: string; description: string } {
	return {
		summary: markdown.match(/^# (.+)$/m)?.[1]?.trim() ?? "",
		description: markdown.match(/^## Description\n([\s\S]*?)$/m)?.[1]?.trim() ?? "",
	};
}

export async function readTaskStateFromArtifacts(
	baseDir: string,
	runId: string,
): Promise<{
	workflow: {
		title: string;
		workflowType: string;
		workflowState: string;
		runId: string;
	};
	taskState: TaskState;
	warnings: string[];
}> {
	const warnings: string[] = [];
	const workflowPath = path.join(baseDir, getWorkflowMdPath(runId));
	const workflowMd = await fs.readFile(workflowPath, "utf8");
	const parsedWorkflow = parseWorkflowMd(workflowMd);

	const tasks = [] as ConstructorParameters<typeof TaskState>[0]["tasks"];
	for (const workflowTask of parsedWorkflow.tasks) {
		const taskPath = path.join(baseDir, getTaskMdPath(runId, workflowTask.id));
		const taskMd = await fs.readFile(taskPath, "utf8");
		const parsedTask = parseTaskMd(taskMd);
		const workflowCommits = [...workflowTask.commitHashes].sort().join(",");
		const taskCommits = [...parsedTask.commitHashes].sort().join(",");
		if (workflowCommits !== taskCommits) {
			warnings.push(
				`Artifact mismatch: workflow.md says ${workflowTask.commitHashes.join(",")}, task.md says ${parsedTask.commitHashes.join(",")} for ${workflowTask.id}.`,
			);
		}

		const steps = [] as NonNullable<(typeof tasks)[number]>["steps"];
		for (const [index, step] of parsedTask.steps.entries()) {
			let summary = step.summary;
			let description = "";
			if (step.artifactPath) {
				const stepSlug = step.artifactPath.replace(/\.md$/, "");
				const stepPath = path.join(baseDir, getStepMdPath(runId, workflowTask.id, stepSlug));
				try {
					const stepMd = await fs.readFile(stepPath, "utf8");
					const parsedStep = parseStepMd(stepMd);
					summary = parsedStep.summary || summary;
					description = parsedStep.description;
				} catch {
					warnings.push(`Missing step artifact: ${step.artifactPath} for ${workflowTask.id}.`);
				}
			}

			steps.push({
				id: `step-${index + 1}`,
				summary,
				description,
				status: toStepStatus(step.status),
				hasArtifact: Boolean(step.artifactPath),
				artifactPath: step.artifactPath,
			});
		}

		tasks.push({
			id: parsedTask.id,
			summary: parsedTask.summary || workflowTask.summary,
			description: parsedTask.description,
			status: toTaskStatus(parsedTask.status),
			steps,
			commitHashes: parsedTask.commitHashes,
			alignmentNeeded: parsedTask.alignmentNeeded,
			taskDir: `tasks/${parsedTask.id}`,
			taskMdPath: `tasks/${parsedTask.id}/task.md`,
		});
	}

	const taskState = new TaskState({
		runTitle: parsedWorkflow.title || undefined,
		tasks,
		currentTaskId: tasks[0]?.id,
		currentStepId: tasks[0]?.steps[0]?.id,
	});
	return {
		workflow: {
			title: parsedWorkflow.title,
			workflowType: parsedWorkflow.workflowType,
			workflowState: parsedWorkflow.workflowState,
			runId: parsedWorkflow.runId,
		},
		taskState,
		warnings,
	};
}
