import {
	createWorkflowRuntime,
	type WorkflowRuntime,
	type WorkflowSnapshot,
} from "./workflow-state.ts";

export interface WorkflowExtensionState {
	workflow: WorkflowSnapshot;
	artifactMtimes: Array<[string, number]>;
}

export function serializeState(
	runtime: WorkflowRuntime,
	artifactMtimes: Map<string, number>,
): WorkflowExtensionState {
	return {
		workflow: runtime.serialize(),
		artifactMtimes: [...artifactMtimes.entries()],
	};
}

export function restoreState(
	data: WorkflowExtensionState | undefined,
): { runtime: WorkflowRuntime; artifactMtimes: Map<string, number> } {
	if (!data) {
		return {
			runtime: createWorkflowRuntime(),
			artifactMtimes: new Map(),
		};
	}

	return {
		runtime: createWorkflowRuntime(data.workflow),
		artifactMtimes: new Map(data.artifactMtimes),
	};
}
