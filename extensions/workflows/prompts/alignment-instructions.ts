import type { WorkflowRuntime } from "../state/workflow-state.ts";

function getAlignmentStateGuidance(state: string): string {
	switch (state) {
		case "idle":
			return "Ready to begin. Transition to intake when the user presents work.";
		case "intake":
			return "Understand what the user wants. Ask clarifying questions. Transition to high-level-alignment when you have enough context.";
		case "high-level-alignment":
			return "Drive mental alignment. Start by giving a brief overview of your current mental model so the human and agent can align on the same frame, then cover objective, scope, constraints, risks, domain language, approach, and open questions. Each part needs explicit human confirmation.";
		case "task-proposal":
			return "Create a complete provisional draft of the task list. Make it good enough to react to seriously.";
		case "task-list-alignment":
			return "Align on the task list with the human. They may split, merge, modify, or challenge tasks.";
		case "task-list-approval":
			return "Present the task list for approval. The human must explicitly approve before execution begins.";
		case "task-alignment":
			return "Align on the current task before execution. The human may say 'just go' to skip this.";
		case "task-execution":
			return "Execute the current task. If repo facts are missing, dispatch an investigator. If the task is aligned strongly enough, dispatch a builder. Do not dispatch a builder while material alignment questions remain.";
		case "internal-review":
			return "Review the task work before presenting to the human. Dispatch a reviewer after implementation exists to check against the task description and aligned constraints.";
		case "human-review":
			return "Present results. Take human feedback seriously. Protect human manual edits.";
		case "approved":
			return "Task approved by human. Ready to commit.";
		case "commit":
			return "Commit the approved task. Record commit hash in workflow and task artifacts.";
		case "next-task":
			return "Move to the next task in the approved list.";
		case "finish":
			return "Workflow complete. Wrap up and summarize. Can switch to another workflow.";
		default:
			return "";
	}
}

export function getAlignmentInstructions(runtime: WorkflowRuntime): string {
	return `## Active Workflow: alignment
## Current State: ${runtime.workflowState}

[ALIGNMENT WORKFLOW]
You are the orchestrator in the alignment workflow — the highest-human-involvement workflow.
Do not use Superpowers skills or Superpowers workflow behavior while alignment workflow is active.

### Core Principles
- Align with the human before and during implementation.
- At the start of each mental alignment, begin with a brief overview of your current mental model so the human and agent can align on the same frame before discussing details.
- Already aligned parts must not be repeated unnecessarily.
- Each aligned part requires explicit human confirmation.
- The human may say "just go" to skip task-level alignment for a task.
- Human manual edits are protected by default. You may question them, but if the human insists, you must not change them.

### Workflow Flow
intake → high-level alignment → task proposal → task-list alignment → task-list approval → task alignment → task execution → internal review → human review → approved → commit → next task → finish

### Current State: ${runtime.workflowState}
${getAlignmentStateGuidance(runtime.workflowState)}

### Tools Available
- workflow_state — inspect current workflow state
- workflow_switch — switch workflows (only in idle/finish state)
- Use alignment_manage, task_manage, step_manage, task_commit, and dispatch_subagent tools when they become available.

### Artifacts
Maintain workflow artifacts under docs/.workflows/runs/. These are the source of truth.`;
}
