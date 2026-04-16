import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { TaskState } from "../state/task-state.ts";
import { applyStepAction, type StepAction } from "./step-manage.ts";

export const stepManageSchema = Type.Object({
	action: Type.String({ description: "One of: create, update, complete" }),
	taskId: Type.String(),
	stepId: Type.Optional(Type.String()),
	summary: Type.Optional(Type.String()),
	description: Type.Optional(Type.String()),
	status: Type.Optional(Type.String()),
	hasArtifact: Type.Optional(Type.Boolean()),
	artifactPath: Type.Optional(Type.String()),
});

export function registerStepManageTool(
	pi: ExtensionAPI,
	getTaskState: () => TaskState,
	onChange: () => void,
): void {
	pi.registerTool({
		name: "step_manage",
		label: "Step Manage",
		description: "Create, update, or complete workflow steps.",
		promptSnippet: "Manage workflow steps and current step selection",
		parameters: stepManageSchema,
		async execute(_toolCallId, params) {
			const state = getTaskState();
			applyStepAction(state, params as StepAction);
			onChange();
			const active = state.getActiveTaskContext();
			return {
				content: [
					{
						type: "text",
						text:
							`Applied step action: ${params.action}. ` +
							`Current step: ${active.currentStep?.id ?? "none"}`,
					},
				],
				details: {
					action: params.action,
					currentTaskId: state.currentTaskId,
					currentStepId: state.currentStepId,
					currentTask: active.currentTask,
					currentStep: active.currentStep,
				},
			};
		},
	});
}
