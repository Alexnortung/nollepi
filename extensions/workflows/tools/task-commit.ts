import { TaskState } from "../state/task-state.ts";

export function applyTaskCommit(
	state: TaskState,
	input: { taskId: string; commitHash: string; status?: string },
): TaskState {
	state.recordTaskCommit(input.taskId, input.commitHash);
	if (input.status) {
		state.updateTask(input.taskId, { status: input.status as any });
	}
	state.currentTaskId = input.taskId;
	return state;
}
