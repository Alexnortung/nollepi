import type { WorkflowName } from "../state/workflow-state.ts";

const BASE_TOOLS = ["read", "bash", "edit", "write"];
const EXTRA_TOOLS = ["grep", "find", "ls"];
const WORKFLOW_CORE_TOOLS = [
	"workflow_switch",
	"workflow_state",
	"workflow_transition",
];

const WORKFLOW_TOOL_SETS: Record<WorkflowName, string[]> = {
	base: [...BASE_TOOLS, ...WORKFLOW_CORE_TOOLS],
	superpowers: [...BASE_TOOLS, ...WORKFLOW_CORE_TOOLS],
	alignment: [...BASE_TOOLS, ...WORKFLOW_CORE_TOOLS, "task_manage", "step_manage", "task_commit"],
	autonomous: [...BASE_TOOLS, ...WORKFLOW_CORE_TOOLS, "task_manage", "step_manage", "task_commit", ...EXTRA_TOOLS],
};

export function getToolsForWorkflow(
	workflow: WorkflowName,
	_state: string,
): string[] {
	return WORKFLOW_TOOL_SETS[workflow];
}
