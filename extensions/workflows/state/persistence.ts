import { AlignmentState, type AlignmentSnapshot } from "./alignment-state.ts";
import { SubagentState } from "./subagent-state.ts";
import type { SubagentRunSnapshot } from "../subagents/contracts.ts";
import { TaskState, type TaskRuntimeState } from "./task-state.ts";
import { TaskOrchestratorState, type TaskOrchestratorSnapshot } from "./task-orchestrator-state.ts";
import {
	createWorkflowRuntime,
	type WorkflowRuntime,
	type WorkflowSnapshot,
} from "./workflow-state.ts";

export interface WorkflowExtensionState {
	workflow: WorkflowSnapshot;
	artifactMtimes: Array<[string, number]>;
	tasks?: TaskRuntimeState;
	alignment?: AlignmentSnapshot;
	subagents?: SubagentRunSnapshot;
	taskOrchestrator?: TaskOrchestratorSnapshot;
}

export function serializeState(
	runtime: WorkflowRuntime,
	artifactMtimes: Map<string, number>,
	taskState?: TaskState,
	alignmentState?: AlignmentState,
	subagentState?: SubagentState,
	taskOrchestratorState?: TaskOrchestratorState,
): WorkflowExtensionState {
	return {
		workflow: runtime.serialize(),
		artifactMtimes: [...artifactMtimes.entries()],
		tasks: taskState?.serialize(),
		alignment: alignmentState?.serialize(),
		subagents: subagentState?.serialize(),
		taskOrchestrator: taskOrchestratorState?.serialize(),
	};
}

export function restoreState(
	data: WorkflowExtensionState | undefined,
): {
	runtime: WorkflowRuntime;
	artifactMtimes: Map<string, number>;
	taskState: TaskState;
	alignmentState: AlignmentState;
	subagentState: SubagentState;
	taskOrchestratorState: TaskOrchestratorState;
} {
	if (!data) {
		return {
			runtime: createWorkflowRuntime(),
			artifactMtimes: new Map(),
			taskState: new TaskState(),
			alignmentState: new AlignmentState(),
			subagentState: new SubagentState(),
			taskOrchestratorState: new TaskOrchestratorState(),
		};
	}

	return {
		runtime: createWorkflowRuntime(data.workflow),
		artifactMtimes: new Map(data.artifactMtimes),
		taskState: TaskState.restore(data.tasks),
		alignmentState: AlignmentState.restore(data.alignment),
		subagentState: SubagentState.restore(data.subagents),
		taskOrchestratorState: TaskOrchestratorState.restore(data.taskOrchestrator),
	};
}
