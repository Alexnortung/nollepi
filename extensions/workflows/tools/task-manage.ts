import { TaskState } from "../state/task-state.ts";

export function applyTaskAction(state: TaskState, input: any): TaskState {
	switch (input.action) {
		case "create":
			state.addTask({
				summary: input.summary,
				description: input.description,
				alignmentNeeded: input.alignmentNeeded ?? true,
			});
			return state;
		case "update":
			state.updateTask(input.taskId, {
				summary: input.summary,
				description: input.description,
				status: input.status,
				alignmentNeeded: input.alignmentNeeded,
			});
			return state;
		case "split":
			state.splitTask(input.taskId, input.replacements);
			return state;
		case "merge":
			state.mergeTasks(input.taskIds, {
				summary: input.summary,
				description: input.description,
				alignmentNeeded: input.alignmentNeeded ?? true,
			});
			return state;
		case "select":
			state.selectCurrentTask(input.taskId);
			return state;
		default:
			throw new Error(`Unknown action: ${input.action}`);
	}
}
