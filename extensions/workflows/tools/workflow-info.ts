import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import type { WorkflowRuntime } from "../state/workflow-state.ts";

export function registerWorkflowStateTool(pi: ExtensionAPI, getRuntime: () => WorkflowRuntime): void {
	pi.registerTool({
		name: "workflow_state",
		label: "Workflow State",
		description:
			"Read the current workflow state: active workflow, current state, valid transitions, and run ID.",
		promptSnippet: "Inspect current workflow state, valid transitions, and run ID",
		parameters: Type.Object({}),

		async execute() {
			const runtime = getRuntime();
			const result = {
				activeWorkflow: runtime.activeWorkflow,
				workflowState: runtime.workflowState,
				runId: runtime.runId ?? null,
				canSwitch: runtime.canSwitch(),
				validTransitions: runtime.getValidTransitions(),
				validStates: runtime.getValidStates(),
			};

			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				details: result,
			};
		},
	});
}
