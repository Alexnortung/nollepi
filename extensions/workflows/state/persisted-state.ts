import { AlignmentState, type AlignmentCategory, type AlignmentPart } from "./alignment-state.ts";
import { TaskState, type TaskOutcomeSummary, type WorkflowStep, type WorkflowTask } from "./task-state.ts";
import {
	createWorkflowRuntime,
	type WorkflowRuntime,
} from "./workflow-state.ts";
import type {
	PersistedAlignmentCategory,
	PersistedAlignmentPart,
	PersistedAlignmentState,
	PersistedTaskOutcomeSummary,
	PersistedWorkflowState,
	PersistedWorkflowStep,
	PersistedWorkflowTask,
} from "./workflow-persistence.ts";

function getTaskDir(taskId: string): string {
	return `tasks/${taskId}`;
}

function getTaskMdPath(taskId: string): string {
	return `${getTaskDir(taskId)}/task.md`;
}

function getNextAlignmentPartId(categories: PersistedAlignmentCategory[]): number {
	let maxPartNumber = 0;
	for (const category of categories) {
		for (const part of category.parts) {
			const match = /^part-(\d+)$/.exec(part.id);
			if (!match) continue;
			maxPartNumber = Math.max(maxPartNumber, Number(match[1]));
		}
	}
	return maxPartNumber + 1;
}

export function toPersistedTaskOutcomeSummary(
	summary: TaskOutcomeSummary | undefined,
): PersistedTaskOutcomeSummary | undefined {
	if (!summary) return undefined;
	return {
		changedFiles: [...summary.changedFiles],
		relevantSymbols: [...summary.relevantSymbols],
		notes: [...summary.notes],
	};
}

export function restorePersistedTaskOutcomeSummary(
	summary: PersistedTaskOutcomeSummary | undefined,
): TaskOutcomeSummary | undefined {
	if (!summary) return undefined;
	return {
		changedFiles: [...summary.changedFiles],
		relevantSymbols: [...summary.relevantSymbols],
		notes: [...summary.notes],
	};
}

export function toPersistedWorkflowStep(step: WorkflowStep): PersistedWorkflowStep {
	return {
		id: step.id,
		summary: step.summary,
		description: step.description,
		status: step.status,
	};
}

export function restorePersistedWorkflowStep(step: PersistedWorkflowStep): WorkflowStep {
	return {
		id: step.id,
		summary: step.summary,
		description: step.description,
		status: step.status,
		hasArtifact: false,
	};
}

export function toPersistedWorkflowTask(task: WorkflowTask): PersistedWorkflowTask {
	return {
		id: task.id,
		summary: task.summary,
		description: task.description,
		status: task.status,
		alignmentRequired: task.alignmentNeeded,
		commitHashes: [...task.commitHashes],
		outcomeSummary: toPersistedTaskOutcomeSummary(task.outcomeSummary),
		steps: task.steps.map((step) => toPersistedWorkflowStep(step)),
	};
}

export function restorePersistedWorkflowTask(task: PersistedWorkflowTask): WorkflowTask {
	return {
		id: task.id,
		summary: task.summary,
		description: task.description,
		status: task.status,
		alignmentNeeded: task.alignmentRequired,
		commitHashes: [...task.commitHashes],
		outcomeSummary: restorePersistedTaskOutcomeSummary(task.outcomeSummary),
		steps: task.steps.map((step) => restorePersistedWorkflowStep(step)),
		taskDir: getTaskDir(task.id),
		taskMdPath: getTaskMdPath(task.id),
	};
}

export function toPersistedAlignmentPart(part: AlignmentPart): PersistedAlignmentPart {
	return {
		id: part.id,
		summary: part.summary,
		details: part.details,
		state: part.state,
	};
}

export function restorePersistedAlignmentPart(part: PersistedAlignmentPart): AlignmentPart {
	return {
		id: part.id,
		summary: part.summary,
		details: part.details,
		state: part.state,
	};
}

export function toPersistedAlignmentCategory(category: AlignmentCategory): PersistedAlignmentCategory {
	return {
		name: category.name,
		relevance: category.relevance,
		parts: category.parts.map((part) => toPersistedAlignmentPart(part)),
	};
}

export function restorePersistedAlignmentCategory(category: PersistedAlignmentCategory): AlignmentCategory {
	return {
		name: category.name,
		relevance: category.relevance,
		parts: category.parts.map((part) => restorePersistedAlignmentPart(part)),
	};
}

export function toPersistedAlignmentState(alignmentState: AlignmentState | undefined): PersistedAlignmentState {
	return {
		categories: alignmentState?.categories.map((category) => toPersistedAlignmentCategory(category)) ?? [],
	};
}

export function restorePersistedAlignmentState(
	alignmentState: PersistedAlignmentState | undefined,
): AlignmentState {
	if (!alignmentState) return new AlignmentState();
	return new AlignmentState({
		categories: alignmentState.categories.map((category) => restorePersistedAlignmentCategory(category)),
		nextPartId: getNextAlignmentPartId(alignmentState.categories),
	});
}

export function toPersistedWorkflowState(
	runtime: WorkflowRuntime,
	taskState?: TaskState,
	alignmentState?: AlignmentState,
): PersistedWorkflowState {
	return {
		workflow: runtime.activeWorkflow,
		workflowState: runtime.workflowState,
		runId: runtime.runId,
		runTitle: taskState?.runTitle,
		runSlug: taskState?.runSlug,
		currentTaskId: taskState?.currentTaskId,
		currentStepId: taskState?.currentStepId,
		tasks: taskState?.tasks.map((task) => toPersistedWorkflowTask(task)) ?? [],
		alignment: toPersistedAlignmentState(alignmentState),
	};
}

export function restorePersistedWorkflowState(
	state: PersistedWorkflowState | undefined,
): {
	runtime: WorkflowRuntime;
	taskState: TaskState;
	alignmentState: AlignmentState;
} {
	if (!state) {
		return {
			runtime: createWorkflowRuntime(),
			taskState: new TaskState(),
			alignmentState: new AlignmentState(),
		};
	}

	return {
		runtime: createWorkflowRuntime({
			activeWorkflow: state.workflow,
			workflowState: state.workflowState,
			runId: state.runId,
		}),
		taskState: new TaskState({
			runTitle: state.runTitle,
			runSlug: state.runSlug,
			tasks: state.tasks.map((task) => restorePersistedWorkflowTask(task)),
			currentTaskId: state.currentTaskId,
			currentStepId: state.currentStepId,
		}),
		alignmentState: restorePersistedAlignmentState(state.alignment),
	};
}
