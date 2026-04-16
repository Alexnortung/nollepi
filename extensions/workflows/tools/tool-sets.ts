import type { WorkflowName } from "../state/workflow-state.ts";

const BUILTIN_TOOLS = ["read", "bash", "edit", "write", "grep", "find", "ls"];
const WORKFLOW_CORE_TOOLS = ["workflow_switch", "workflow_state"];

const WORKFLOW_TOOL_SETS: Record<WorkflowName, string[]> = {
	base: [...BUILTIN_TOOLS, ...WORKFLOW_CORE_TOOLS],
	superpowers: [...BUILTIN_TOOLS, ...WORKFLOW_CORE_TOOLS],
	alignment: [...BUILTIN_TOOLS, ...WORKFLOW_CORE_TOOLS],
	autonomous: [...BUILTIN_TOOLS, ...WORKFLOW_CORE_TOOLS],
};

export function getToolsForWorkflow(workflow: WorkflowName, _state: string): string[] {
	return WORKFLOW_TOOL_SETS[workflow];
}
