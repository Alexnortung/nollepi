export interface TaskOutcomeSummary {
	changedFiles: string[];
	relevantSymbols: string[];
	notes: string[];
}

export type TaskStatus =
	| "proposed"
	| "approved"
	| "in-progress"
	| "review"
	| "approved-complete"
	| "committed";

export type StepStatus = "pending" | "in-progress" | "done";

export interface WorkflowStep {
	id: string;
	summary: string;
	description: string;
	status: StepStatus;
	hasArtifact: boolean;
	artifactPath?: string;
}

export interface WorkflowTask {
	id: string;
	summary: string;
	description: string;
	status: TaskStatus;
	steps: WorkflowStep[];
	commitHashes: string[];
	alignmentNeeded: boolean;
	outcomeSummary?: TaskOutcomeSummary;
	taskDir: string;
	taskMdPath: string;
}

export interface TaskRuntimeState {
	runTitle?: string;
	runSlug?: string;
	tasks: WorkflowTask[];
	currentTaskId?: string;
	currentStepId?: string;
}

export interface ActiveTaskContext {
	currentTask?: WorkflowTask;
	currentStep?: WorkflowStep;
}

function slugify(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/--+/g, "-");
}

function twoDigit(n: number): string {
	return String(n).padStart(2, "0");
}

function buildTaskId(index: number, summary: string): string {
	return `${twoDigit(index)}-${slugify(summary)}`;
}

function getTaskDir(taskId: string): string {
	return `tasks/${taskId}`;
}

function getTaskMdPath(taskId: string): string {
	return `${getTaskDir(taskId)}/task.md`;
}

export class TaskState implements TaskRuntimeState {
	runTitle?: string;
	runSlug?: string;
	tasks: WorkflowTask[];
	currentTaskId?: string;
	currentStepId?: string;

	constructor(snapshot?: TaskRuntimeState) {
		this.runTitle = snapshot?.runTitle;
		this.runSlug = snapshot?.runSlug;
		this.tasks = snapshot?.tasks ? structuredClone(snapshot.tasks) : [];
		this.currentTaskId = snapshot?.currentTaskId;
		this.currentStepId = snapshot?.currentStepId;
	}

	private renumberTasks(): void {
		this.tasks = this.tasks.map((task, index) => {
			const id = buildTaskId(index + 1, task.summary);
			return {
				...task,
				id,
				taskDir: getTaskDir(id),
				taskMdPath: getTaskMdPath(id),
			};
		});
	}

	addTask(input: { summary: string; description: string; alignmentNeeded: boolean }): WorkflowTask {
		const id = buildTaskId(this.tasks.length + 1, input.summary);
		const task: WorkflowTask = {
			id,
			summary: input.summary,
			description: input.description,
			status: "proposed",
			steps: [],
			commitHashes: [],
			alignmentNeeded: input.alignmentNeeded,
			taskDir: getTaskDir(id),
			taskMdPath: getTaskMdPath(id),
		};

		this.tasks.push(task);
		this.currentTaskId ??= task.id;
		return task;
	}

	updateTask(
		taskId: string,
		patch: Partial<Pick<WorkflowTask, "summary" | "description" | "status" | "alignmentNeeded">>,
	): void {
		const definedPatch = Object.fromEntries(
			Object.entries(patch).filter(([, value]) => value !== undefined),
		) as Partial<Pick<WorkflowTask, "summary" | "description" | "status" | "alignmentNeeded">>;
		this.tasks = this.tasks.map((task) => (task.id === taskId ? { ...task, ...definedPatch } : task));
		this.renumberTasks();
	}

	splitTask(
		taskId: string,
		replacements: Array<{ summary: string; description: string; alignmentNeeded: boolean }>,
	): void {
		const index = this.tasks.findIndex((task) => task.id === taskId);
		if (index === -1) throw new Error(`Unknown task: ${taskId}`);

		const replacementTasks: WorkflowTask[] = replacements.map((item) => ({
			id: "",
			summary: item.summary,
			description: item.description,
			status: "proposed",
			steps: [],
			commitHashes: [],
			alignmentNeeded: item.alignmentNeeded,
			taskDir: "",
			taskMdPath: "",
		}));

		this.tasks = [
			...this.tasks.slice(0, index),
			...replacementTasks,
			...this.tasks.slice(index + 1),
		];
		this.renumberTasks();
		this.currentTaskId = this.tasks[index]?.id;
		this.currentStepId = this.tasks[index]?.steps[0]?.id;
	}

	mergeTasks(
		taskIds: string[],
		merged: { summary: string; description: string; alignmentNeeded: boolean },
	): void {
		const kept = this.tasks.filter((task) => !taskIds.includes(task.id));
		const mergedTask: WorkflowTask = {
			id: "",
			summary: merged.summary,
			description: merged.description,
			status: "proposed",
			steps: [],
			commitHashes: [],
			alignmentNeeded: merged.alignmentNeeded,
			taskDir: "",
			taskMdPath: "",
		};
		this.tasks = [...kept, mergedTask];
		this.renumberTasks();
		this.currentTaskId = this.tasks.at(-1)?.id;
		this.currentStepId = this.tasks.at(-1)?.steps[0]?.id;
	}

	addStep(input: {
		taskId: string;
		summary: string;
		description: string;
		hasArtifact: boolean;
		artifactPath?: string;
	}): WorkflowStep {
		let createdStep: WorkflowStep | undefined;
		this.tasks = this.tasks.map((task) => {
			if (task.id !== input.taskId) return task;
			createdStep = {
				id: `step-${task.steps.length + 1}`,
				summary: input.summary,
				description: input.description,
				status: "pending",
				hasArtifact: input.hasArtifact,
				artifactPath: input.artifactPath,
			};
			return {
				...task,
				steps: [...task.steps, createdStep],
			};
		});
		if (!createdStep) throw new Error(`Unknown task: ${input.taskId}`);
		this.currentStepId ??= createdStep.id;
		return createdStep;
	}

	updateStep(taskId: string, stepId: string, patch: Partial<WorkflowStep>): void {
		this.tasks = this.tasks.map((task) => {
			if (task.id !== taskId) return task;
			return {
				...task,
				steps: task.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
			};
		});
	}

	completeStep(taskId: string, stepId: string): void {
		this.updateStep(taskId, stepId, { status: "done" });
	}

	recordTaskOutcome(taskId: string, summary: TaskOutcomeSummary): void {
		this.tasks = this.tasks.map((task) => {
			if (task.id !== taskId) return task;
			return { ...task, outcomeSummary: summary };
		});
	}

	getCompletedOutcomeSummaries(): Array<{ taskId: string; summary: TaskOutcomeSummary }> {
		return this.tasks
			.filter((task) => task.outcomeSummary !== undefined)
			.map((task) => ({ taskId: task.id, summary: task.outcomeSummary! }));
	}

	recordTaskCommit(taskId: string, hash: string): void {
		this.tasks = this.tasks.map((task) => {
			if (task.id !== taskId) return task;
			return {
				...task,
				commitHashes: task.commitHashes.includes(hash) ? task.commitHashes : [...task.commitHashes, hash],
			};
		});
	}

	selectCurrentTask(taskId: string): void {
		const task = this.tasks.find((item) => item.id === taskId);
		this.currentTaskId = taskId;
		this.currentStepId = task?.steps[0]?.id;
	}

	getActiveTaskContext(): ActiveTaskContext {
		const currentTask = this.tasks.find((task) => task.id === this.currentTaskId);
		const currentStep =
			currentTask?.steps.find((step) => step.id === this.currentStepId) ??
			currentTask?.steps.find((step) => step.status !== "done") ??
			currentTask?.steps[0];

		return { currentTask, currentStep };
	}

	rehydrateArtifactLinkage(source: Pick<TaskState, "tasks">): void {
		this.tasks = this.tasks.map((task) => {
			const sourceTask = source.tasks.find((candidate) => candidate.id === task.id);
			if (!sourceTask) return task;
			return {
				...task,
				taskDir: sourceTask.taskDir,
				taskMdPath: sourceTask.taskMdPath,
				steps: task.steps.map((step) => {
					const sourceStep = sourceTask.steps.find((candidate) => candidate.id === step.id);
					if (!sourceStep) return step;
					return {
						...step,
						hasArtifact: sourceStep.hasArtifact,
						artifactPath: sourceStep.artifactPath,
					};
				}),
			};
		});
	}

	serialize(): TaskRuntimeState {
		return {
			runTitle: this.runTitle,
			runSlug: this.runSlug,
			tasks: structuredClone(this.tasks),
			currentTaskId: this.currentTaskId,
			currentStepId: this.currentStepId,
		};
	}

	static restore(snapshot?: TaskRuntimeState): TaskState {
		return new TaskState(snapshot);
	}
}
