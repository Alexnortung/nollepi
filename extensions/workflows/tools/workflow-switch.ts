import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import type { WorkflowName, WorkflowRuntime } from "../state/workflow-state.ts";

export function registerWorkflowSwitchTool(
	pi: ExtensionAPI,
	getRuntime: () => WorkflowRuntime,
	onSwitch: (newWorkflow: WorkflowName) => void,
): void {
	pi.registerTool({
		name: "workflow_switch",
		label: "Workflow Switch",
		description:
			"Switch to a different workflow. Can only switch when the current workflow is in a switchable state (idle/finish). " +
			"Available workflows: base (lightweight default), superpowers (Superpowers skills overlay), " +
			"alignment (high-human-involvement collaborative), autonomous (execution-heavy with agent authority).",
		promptSnippet: "Switch between base, superpowers, alignment, and autonomous workflows",
		promptGuidelines: [
			"Check workflow_state before switching to confirm canSwitch is true.",
			"The autonomous workflow requires sandbox and isolated worktree — verify before switching.",
		],
		parameters: Type.Object({
			workflow: StringEnum(["base", "superpowers", "alignment", "autonomous"] as const, {
				description: "Target workflow to switch to",
			}),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const runtime = getRuntime();
			const target = params.workflow as WorkflowName;

			if (target === runtime.activeWorkflow) {
				return {
					content: [
						{ type: "text", text: `Already in the \"${target}\" workflow (state: ${runtime.workflowState}).` },
					],
					details: { switched: false, reason: "already_active" },
				};
			}

			if (!runtime.canSwitch()) {
				return {
					content: [
						{
							type: "text",
							text:
								`Cannot switch from \"${runtime.activeWorkflow}\" (state: ${runtime.workflowState}). ` +
								`The workflow must be in a switchable state. ` +
								`Switchable states for ${runtime.activeWorkflow}: ${runtime
									.getValidStates()
									.filter((s) => s === "idle" || s === "finish")
									.join(", ")}`,
						},
					],
					details: {
						switched: false,
						reason: "not_switchable",
						currentWorkflow: runtime.activeWorkflow,
						currentState: runtime.workflowState,
					},
				};
			}

			if (target === "autonomous" && ctx.hasUI) {
				const ok = await ctx.ui.confirm(
					"Switch to Autonomous?",
					"Autonomous requires sandbox and isolated worktree. These preconditions are not yet verified. Continue anyway?",
				);
				if (!ok) {
					return {
						content: [{ type: "text", text: "Switch to autonomous cancelled by user." }],
						details: { switched: false, reason: "user_cancelled" },
					};
				}
			}

			const previousWorkflow = runtime.activeWorkflow;
			const previousState = runtime.workflowState;
			runtime.switchTo(target);
			onSwitch(target);

			return {
				content: [
					{
						type: "text",
						text:
							`Switched from \"${previousWorkflow}\" to \"${target}\". ` +
							`Now in state: ${runtime.workflowState}. ` +
							`Valid transitions: ${runtime.getValidTransitions().join(", ")}`,
					},
				],
				details: {
					switched: true,
					previousWorkflow,
					previousState,
					newWorkflow: target,
					newState: runtime.workflowState,
				},
			};
		},
	});
}
