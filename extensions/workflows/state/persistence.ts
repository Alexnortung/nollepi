import { AlignmentState, type AlignmentSnapshot } from "./alignment-state.ts";
import { SubagentState } from "./subagent-state.ts";
import type { SubagentRunSnapshot } from "../subagents/contracts.ts";
import { TaskState, type TaskRuntimeState } from "./task-state.ts";
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
}

export function serializeState(
	runtime: WorkflowRuntime,
	artifactMtimes: Map<string, number>,
	taskState?: TaskState,
	alignmentState?: AlignmentState,
	subagentState?: SubagentState,
): WorkflowExtensionState {
	return {
		workflow: runtime.serialize(),
		artifactMtimes: [...artifactMtimes.entries()],
		tasks: taskState?.serialize(),
		alignment: alignmentState?.serialize(),
		subagents: subagentState?.serialize(),
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
} {
	if (!data) {
		return {
			runtime: createWorkflowRuntime(),
			artifactMtimes: new Map(),
			taskState: new TaskState(),
			alignmentState: new AlignmentState(),
			subagentState: new SubagentState(),
		};
	}

	return {
		runtime: createWorkflowRuntime(data.workflow),
		artifactMtimes: new Map(data.artifactMtimes),
		taskState: TaskState.restore(data.tasks),
		alignmentState: AlignmentState.restore(data.alignment),
		subagentState: SubagentState.restore(data.subagents),
	};
}
