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
}

export function serializeState(
	runtime: WorkflowRuntime,
	artifactMtimes: Map<string, number>,
	taskState?: TaskState,
): WorkflowExtensionState {
	return {
		workflow: runtime.serialize(),
		artifactMtimes: [...artifactMtimes.entries()],
		tasks: taskState?.serialize(),
	};
}

export function restoreState(
	data: WorkflowExtensionState | undefined,
): { runtime: WorkflowRuntime; artifactMtimes: Map<string, number>; taskState: TaskState } {
	if (!data) {
		return {
			runtime: createWorkflowRuntime(),
			artifactMtimes: new Map(),
			taskState: new TaskState(),
		};
	}

	return {
		runtime: createWorkflowRuntime(data.workflow),
		artifactMtimes: new Map(data.artifactMtimes),
		taskState: TaskState.restore(data.tasks),
	};
}
