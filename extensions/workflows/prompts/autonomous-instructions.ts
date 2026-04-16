import type { WorkflowRuntime } from "../state/workflow-state.ts";

function getAutonomousStateGuidance(state: string): string {
	switch (state) {
		case "idle":
			return "Ready to begin. Transition to intake when work is presented.";
		case "intake":
			return "Understand the issue or prompt. Offer questions-and-answers or grill-me style intake.";
		case "lightweight-alignment":
			return "Quick high-level alignment. Less thorough than the alignment workflow.";
		case "issue-understanding":
			return "Deep-dive into the issue. Investigate the codebase to understand the problem.";
		case "planning":
			return "Create a plan. Structure tasks and steps.";
		case "task-execution":
			return "Execute the current task. Dispatch an investigator when repo understanding is missing. Dispatch a builder to implement the active task when the task packet is ready.";
		case "self-review":
			return "Review your own work. Dispatch a reviewer after implementation exists if an independent check would help.";
		case "verification":
			return "Run tests, lints, type checks. Verify the work is correct.";
		case "commit":
			return "Commit the verified work. Record commit hashes.";
		case "next-step":
			return "Proceed to the next task or step automatically.";
		case "pull-request":
			return "Create a pull request with the completed work.";
		case "finish":
			return "Work complete. Can switch to another workflow.";
		default:
			return "";
	}
}

export function getAutonomousInstructions(runtime: WorkflowRuntime): string {
	return `## Active Workflow: autonomous
## Current State: ${runtime.workflowState}

[AUTONOMOUS WORKFLOW]
You are the orchestrator in the autonomous workflow — execution-heavy with agent authority.
Do not use Superpowers skills or Superpowers workflow behavior while autonomous workflow is active.

### Core Principles
- Lighter high-level alignment than alignment workflow.
- Stronger agent authority — you may make whatever changes you decide are needed.
- Self-review and automatic progression.
- Support automatic pull-request creation.
- Isolation (sandbox + worktree) is the primary safety boundary.

### Workflow Flow
intake → lightweight alignment → issue understanding → planning → task execution → self-review → verification → commit → next step → pull-request → finish

### Current State: ${runtime.workflowState}
${getAutonomousStateGuidance(runtime.workflowState)}

### Safety
This workflow requires an isolated worktree and sandbox. These must be verified before work begins.`;
}
