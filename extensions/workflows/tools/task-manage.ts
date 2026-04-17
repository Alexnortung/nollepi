import { TaskState, type TaskOutcomeSummary, type TaskStatus } from "../state/task-state.ts";

export type TaskAction =
	| { action: "create"; summary: string; description: string; alignmentNeeded?: boolean }
	| { action: "update"; taskId: string; summary?: string; description?: string; status?: TaskStatus; alignmentNeeded?: boolean }
	| { action: "split"; taskId: string; replacements: Array<{ summary: string; description: string; alignmentNeeded: boolean }> }
	| { action: "merge"; taskIds: string[]; summary: string; description: string; alignmentNeeded?: boolean }
	| { action: "select"; taskId: string }
	| { action: "record_outcome"; taskId: string; changedFiles: string[]; relevantSymbols: string[]; notes: string[] };

export function applyTaskAction(state: TaskState, input: TaskAction): TaskState {
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
		case "record_outcome": {
			const summary: TaskOutcomeSummary = {
				changedFiles: input.changedFiles,
				relevantSymbols: input.relevantSymbols,
				notes: input.notes,
			};
			state.recordTaskOutcome(input.taskId, summary);
			return state;
		}
	}
}
