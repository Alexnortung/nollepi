import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import type { AlignmentState } from "../state/alignment-state.ts";
import type { SubagentState } from "../state/subagent-state.ts";
import type { TaskState } from "../state/task-state.ts";
import type { TaskOrchestratorState } from "../state/task-orchestrator-state.ts";
import type { WorkflowRuntime } from "../state/workflow-state.ts";

export function registerWorkflowStateTool(
	pi: ExtensionAPI,
	getRuntime: () => WorkflowRuntime,
	getTaskState?: () => TaskState,
	getAlignmentState?: () => AlignmentState,
	getSubagentState?: () => SubagentState,
	getTaskOrchestratorState?: () => TaskOrchestratorState,
): void {
	pi.registerTool({
		name: "workflow_state",
		label: "Workflow State",
		description:
			"Read the current workflow state: active workflow, current state, valid transitions, and run ID.",
		promptSnippet: "Inspect current workflow state, valid transitions, and run ID",
		parameters: Type.Object({}),

		async execute() {
			const runtime = getRuntime();
			const taskState = getTaskState?.();
			const alignState = getAlignmentState?.();
			const subagentState = getSubagentState?.();
			const taskOrchestratorState = getTaskOrchestratorState?.();
			const active = taskState?.getActiveTaskContext();
			const alignSummary = alignState?.getSummary();
			const result = {
				activeWorkflow: runtime.activeWorkflow,
				workflowState: runtime.workflowState,
				runId: runtime.runId ?? null,
				canSwitch: runtime.canSwitch(),
				validTransitions: runtime.getValidTransitions(),
				validStates: runtime.getValidStates(),
				currentTaskId: taskState?.currentTaskId ?? null,
				currentStepId: taskState?.currentStepId ?? null,
				currentTask: active?.currentTask ?? null,
				currentStep: active?.currentStep ?? null,
				alignment: alignSummary ?? null,
				taskOrchestrator: taskOrchestratorState?.getSession() ?? null,
				subagents: subagentState?.runs ?? [],
				activeSubagents: subagentState?.getActiveRuns() ?? [],
			};

			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				details: result,
			};
		},
	});
}
