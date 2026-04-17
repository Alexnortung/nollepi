import type { AlignmentCategory, AlignmentState } from "../state/alignment-state.ts";
import type { SubagentState } from "../state/subagent-state.ts";
import type { TaskState } from "../state/task-state.ts";
import type { WorkflowRuntime } from "../state/workflow-state.ts";

export interface TaskOrchestratorPacket {
	workflow: string;
	workflowState: string;
	runId?: string;
	task: {
		id: string;
		summary: string;
		description: string;
		status: string;
	};
	alignedContext: {
		objective: string[];
		scope: string[];
		constraints: string[];
		approach: string[];
		domainLanguage: string[];
	};
	priorTaskSummaries: Array<{
		taskId: string;
		changedFiles: string[];
		relevantSymbols: string[];
		notes: string[];
	}>;
	latestBuilderResult?: {
		summary: string;
		changedFiles: string[];
		commits: string[];
		verification: string[];
	};
}

interface BuildTaskOrchestratorPacketContext {
	runtime: WorkflowRuntime;
	taskState: TaskState;
	alignmentState: AlignmentState;
	subagentState: SubagentState;
}

function alignedSummaries(categories: AlignmentCategory[], categoryName: string): string[] {
	return categories
		.find((category) => category.name === categoryName)
		?.parts.filter((part) => part.state === "aligned")
		.map((part) => part.summary) ?? [];
}

export function buildTaskOrchestratorPacket(ctx: BuildTaskOrchestratorPacketContext): TaskOrchestratorPacket {
	const active = ctx.taskState.getActiveTaskContext();
	if (!active.currentTask) throw new Error("Task orchestrator requires an active task.");

	const latestBuilder = ctx.subagentState.getLatestBuilderResult(active.currentTask.id);

	return {
		workflow: ctx.runtime.activeWorkflow,
		workflowState: ctx.runtime.workflowState,
		runId: ctx.runtime.runId,
		task: {
			id: active.currentTask.id,
			summary: active.currentTask.summary,
			description: active.currentTask.description,
			status: active.currentTask.status,
		},
		alignedContext: {
			objective: alignedSummaries(ctx.alignmentState.categories, "objective"),
			scope: alignedSummaries(ctx.alignmentState.categories, "scope"),
			constraints: alignedSummaries(ctx.alignmentState.categories, "constraints"),
			approach: alignedSummaries(ctx.alignmentState.categories, "approach"),
			domainLanguage: alignedSummaries(ctx.alignmentState.categories, "domain-language"),
		},
		priorTaskSummaries: ctx.taskState.getCompletedOutcomeSummaries().map(({ taskId, summary }) => ({
			taskId,
			changedFiles: summary.changedFiles,
			relevantSymbols: summary.relevantSymbols,
			notes: summary.notes,
		})),
		latestBuilderResult: latestBuilder?.role === "builder"
			? {
				summary: latestBuilder.summary,
				changedFiles: latestBuilder.changedFiles,
				commits: latestBuilder.commits,
				verification: latestBuilder.verification,
			}
			: undefined,
	};
}
