import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { TaskState } from "../state/task-state.ts";
import { applyTaskAction, type TaskAction } from "./task-manage.ts";

export const taskManageSchema = Type.Object({
	action: Type.String({ description: "One of: create, update, split, merge, select, record_outcome" }),
	taskId: Type.Optional(Type.String()),
	taskIds: Type.Optional(Type.Array(Type.String())),
	summary: Type.Optional(Type.String()),
	description: Type.Optional(Type.String()),
	status: Type.Optional(Type.String()),
	alignmentNeeded: Type.Optional(Type.Boolean()),
	replacements: Type.Optional(
		Type.Array(
			Type.Object({
				summary: Type.String(),
				description: Type.String(),
				alignmentNeeded: Type.Boolean(),
			}),
		),
	),
	changedFiles: Type.Optional(Type.Array(Type.String(), { description: "Files changed by this task (for record_outcome)" })),
	relevantSymbols: Type.Optional(Type.Array(Type.String(), { description: "New/modified functions, classes, types introduced (for record_outcome)" })),
	notes: Type.Optional(Type.Array(Type.String(), { description: "Other useful context for the human or later tasks (for record_outcome)" })),
});

export function registerTaskManageTool(
	pi: ExtensionAPI,
	getTaskState: () => TaskState,
	onChange: () => void,
): void {
	pi.registerTool({
		name: "task_manage",
		label: "Task Manage",
		description: "Create, update, split, merge, select workflow tasks, or record a task outcome summary.",
		promptSnippet: "Manage workflow tasks and current task selection. Use record_outcome after task completion to record changedFiles, relevantSymbols, and notes for the high-level orchestrator.",
		parameters: taskManageSchema,
		async execute(_toolCallId, params) {
			const state = getTaskState();
			applyTaskAction(state, params as TaskAction);
			onChange();
			const active = state.getActiveTaskContext();
			return {
				content: [
					{
						type: "text",
						text:
							`Applied task action: ${params.action}. ` +
							`Tasks: ${state.tasks.length}. ` +
							`Current task: ${active.currentTask?.id ?? "none"}`,
					},
				],
				details: {
					action: params.action,
					tasks: state.tasks,
					currentTaskId: state.currentTaskId,
					currentStepId: state.currentStepId,
				},
			};
		},
	});
}
