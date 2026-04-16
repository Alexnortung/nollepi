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

function renumberTasks(tasks: WorkflowTask[]): WorkflowTask[] {
	return tasks.map((task, index) => {
		const id = buildTaskId(index + 1, task.summary);
		return {
			...task,
			id,
			taskDir: getTaskDir(id),
			taskMdPath: getTaskMdPath(id),
		};
	});
}

export function createTaskRuntimeState(): TaskRuntimeState {
	return { tasks: [] };
}

export function addTask(
	state: TaskRuntimeState,
	input: { summary: string; description: string; alignmentNeeded: boolean },
): TaskRuntimeState {
	const id = buildTaskId(state.tasks.length + 1, input.summary);
	const nextTask: WorkflowTask = {
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

	return {
		...state,
		tasks: [...state.tasks, nextTask],
		currentTaskId: state.currentTaskId ?? nextTask.id,
		currentStepId: state.currentStepId,
	};
}

export function updateTask(
	state: TaskRuntimeState,
	taskId: string,
	patch: Partial<Pick<WorkflowTask, "summary" | "description" | "status" | "alignmentNeeded">>,
): TaskRuntimeState {
	const nextTasks = state.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task));
	return { ...state, tasks: renumberTasks(nextTasks) };
}

export function splitTask(
	state: TaskRuntimeState,
	taskId: string,
	replacements: Array<{ summary: string; description: string; alignmentNeeded: boolean }>,
): TaskRuntimeState {
	const index = state.tasks.findIndex((task) => task.id === taskId);
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

	const nextTasks = [
		...state.tasks.slice(0, index),
		...replacementTasks,
		...state.tasks.slice(index + 1),
	];
	const renumbered = renumberTasks(nextTasks);

	return {
		...state,
		tasks: renumbered,
		currentTaskId: renumbered[index]?.id,
		currentStepId: renumbered[index]?.steps[0]?.id,
	};
}

export function mergeTasks(
	state: TaskRuntimeState,
	taskIds: string[],
	merged: { summary: string; description: string; alignmentNeeded: boolean },
): TaskRuntimeState {
	const kept = state.tasks.filter((task) => !taskIds.includes(task.id));
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
	const nextTasks = renumberTasks([...kept, mergedTask]);
	return {
		...state,
		tasks: nextTasks,
		currentTaskId: nextTasks.at(-1)?.id,
		currentStepId: nextTasks.at(-1)?.steps[0]?.id,
	};
}

export function addStep(
	state: TaskRuntimeState,
	taskId: string,
	input: { summary: string; description: string; hasArtifact: boolean; artifactPath?: string },
): TaskRuntimeState {
	let createdStepId: string | undefined;

	const nextTasks = state.tasks.map((task) => {
		if (task.id !== taskId) return task;
		createdStepId = `step-${task.steps.length + 1}`;
		return {
			...task,
			steps: [
				...task.steps,
				{
					id: createdStepId,
					summary: input.summary,
					description: input.description,
					status: "pending",
					hasArtifact: input.hasArtifact,
					artifactPath: input.artifactPath,
				},
			],
		};
	});

	return {
		...state,
		tasks: nextTasks,
		currentStepId: state.currentStepId ?? createdStepId ?? state.currentStepId,
	};
}

export function updateStep(
	state: TaskRuntimeState,
	taskId: string,
	stepId: string,
	patch: Partial<WorkflowStep>,
): TaskRuntimeState {
	return {
		...state,
		tasks: state.tasks.map((task) => {
			if (task.id !== taskId) return task;
			return {
				...task,
				steps: task.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
			};
		}),
	};
}

export function completeStep(state: TaskRuntimeState, taskId: string, stepId: string): TaskRuntimeState {
	return updateStep(state, taskId, stepId, { status: "done" });
}

export function recordTaskCommit(state: TaskRuntimeState, taskId: string, hash: string): TaskRuntimeState {
	return {
		...state,
		tasks: state.tasks.map((task) => {
			if (task.id !== taskId) return task;
			return {
				...task,
				commitHashes: task.commitHashes.includes(hash) ? task.commitHashes : [...task.commitHashes, hash],
			};
		}),
	};
}

export function selectCurrentTask(state: TaskRuntimeState, taskId: string): TaskRuntimeState {
	const task = state.tasks.find((item) => item.id === taskId);
	return {
		...state,
		currentTaskId: taskId,
		currentStepId: task?.steps[0]?.id,
	};
}

export function getActiveTaskContext(state: TaskRuntimeState): ActiveTaskContext {
	const currentTask = state.tasks.find((task) => task.id === state.currentTaskId);
	const currentStep =
		currentTask?.steps.find((step) => step.id === state.currentStepId) ??
		currentTask?.steps.find((step) => step.status !== "done") ??
		currentTask?.steps[0];

	return { currentTask, currentStep };
}
