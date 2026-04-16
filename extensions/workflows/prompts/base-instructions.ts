import type { WorkflowRuntime } from "../state/workflow-state.ts";

export function getBaseInstructions(_runtime: WorkflowRuntime): string {
	return `## Active Workflow: base

You are in the base workflow — lightweight default mode.
Work normally: chat, inspect code, edit files, run commands.
No special orchestration rules apply.
Do not use Superpowers skills or Superpowers workflow behavior while base workflow is active.

To switch to a structured workflow, use the workflow_switch tool.`;
}
