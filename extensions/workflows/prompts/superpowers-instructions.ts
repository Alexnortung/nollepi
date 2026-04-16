import type { WorkflowRuntime } from "../state/workflow-state.ts";

export function getSuperpowersInstructions(runtime: WorkflowRuntime): string {
	return `## Active Workflow: superpowers
## Current State: ${runtime.workflowState}

[SUPERPOWERS WORKFLOW]
You are in Superpowers mode. Use the Superpowers skills actively:
- brainstorming — for exploring requirements and design before implementation
- writing-plans — for creating implementation plans
- subagent-driven-development — for executing plans with subagents
- executing-plans — for inline plan execution
- test-driven-development — for TDD workflow
- systematic-debugging — for debugging
- requesting-code-review — for code review
- finishing-a-development-branch — for completing work

Follow Superpowers skill instructions when loaded. Use the brainstorming skill before any creative work.

To switch workflows, use the workflow_switch tool (only when no structured process is active).`;
}
