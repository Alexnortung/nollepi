import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import type { WorkflowRuntime } from "../state/workflow-state.ts";

export function registerWorkflowTransitionTool(
	pi: ExtensionAPI,
	getRuntime: () => WorkflowRuntime,
	onTransition: () => void,
): void {
	pi.registerTool({
		name: "workflow_transition",
		label: "Workflow Transition",
		description:
			"Transition the current workflow to a new state. Use workflow_state first to see valid transitions from the current state.",
		promptSnippet: "Advance the workflow state machine to the next state",
		promptGuidelines: [
			"Always check workflow_state before transitioning to see which transitions are valid.",
			"Transitions drive the workflow forward — use them to mark progress through the workflow stages.",
		],
		parameters: Type.Object({
			state: Type.String({ description: "Target state to transition to" }),
		}),

		async execute(_toolCallId, params) {
			const runtime = getRuntime();
			const previousState = runtime.workflowState;

			try {
				runtime.transition(params.state);
			} catch (error: any) {
				return {
					content: [{ type: "text", text: `Transition failed: ${error.message}` }],
					details: {
						transitioned: false,
						error: error.message,
						currentState: runtime.workflowState,
						validTransitions: runtime.getValidTransitions(),
					},
				};
			}

			onTransition();

			return {
				content: [
					{
						type: "text",
						text:
							`Transitioned from \"${previousState}\" to \"${runtime.workflowState}\" ` +
							`in workflow \"${runtime.activeWorkflow}\". ` +
							`Valid next transitions: ${runtime.getValidTransitions().join(", ") || "none"}`,
					},
				],
				details: {
					transitioned: true,
					previousState,
					newState: runtime.workflowState,
					workflow: runtime.activeWorkflow,
					validTransitions: runtime.getValidTransitions(),
				},
			};
		},
	});
}
