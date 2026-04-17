import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import type { WorkflowRuntime } from "../state/workflow-state.ts";
import {
	normalizeWorkflowTransitionEvent,
	type WorkflowTransitionEvent,
	type WorkflowTransitionInput,
} from "./workflow-transition-logic.ts";

export function registerWorkflowTransitionTool(
	pi: ExtensionAPI,
	getRuntime: () => WorkflowRuntime,
	onBeforeTransition: (event: WorkflowTransitionEvent) => void,
	onTransition: (event: WorkflowTransitionEvent) => void,
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
			"When alignment human-review ends directly in next-task or finish, include commitIntent / commitMessage / commitHash if the review also settled commit handling.",
			"If the human already committed, include the existing commit hash and do not create a duplicate commit.",
		],
		parameters: Type.Object({
			state: Type.String({ description: "Target state to transition to" }),
			commitIntent: Type.Optional(
				Type.Union([
					Type.Literal("create"),
					Type.Literal("existing"),
				], {
					description:
						"Optional review-exit commit intent. Use create when the agent should make a commit, or existing when review is closing over an existing commit.",
				}),
			),
			commitMessage: Type.Optional(
				Type.String({ description: "Commit message to carry when the transition completes a review-owned commit." }),
			),
			commitHash: Type.Optional(
				Type.String({ description: "Existing commit hash to carry when review completes against an already-created commit." }),
			),
		}),

		async execute(_toolCallId, params) {
			const runtime = getRuntime();
			const transition = normalizeWorkflowTransitionEvent(runtime, params as WorkflowTransitionInput);
			if (!transition.ok) {
				return {
					content: [{ type: "text", text: `Transition failed: ${transition.error}` }],
					details: {
						transitioned: false,
						error: transition.error,
						currentState: runtime.workflowState,
						validTransitions: runtime.getValidTransitions(),
					},
				};
			}

			const event = transition.event;

			try {
				onBeforeTransition(event);
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text", text: `Transition failed: ${message}` }],
					details: {
						transitioned: false,
						error: message,
						currentState: runtime.workflowState,
						validTransitions: runtime.getValidTransitions(),
					},
				};
			}

			try {
				runtime.transition(params.state);
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text", text: `Transition failed: ${message}` }],
					details: {
						transitioned: false,
						error: message,
						currentState: runtime.workflowState,
						validTransitions: runtime.getValidTransitions(),
					},
				};
			}

			onTransition(event);

			return {
				content: [
					{
						type: "text",
						text:
							`Transitioned from \"${event.previousState}\" to \"${runtime.workflowState}\" ` +
							`in workflow \"${runtime.activeWorkflow}\". ` +
							`Valid next transitions: ${runtime.getValidTransitions().join(", ") || "none"}`,
					},
				],
				details: {
					transitioned: true,
					previousState: event.previousState,
					newState: runtime.workflowState,
					workflow: runtime.activeWorkflow,
					commitIntent: event.commitIntent,
					commitMessage: event.commitMessage,
					commitHash: event.commitHash,
					validTransitions: runtime.getValidTransitions(),
				},
			};
		},
	});
}
