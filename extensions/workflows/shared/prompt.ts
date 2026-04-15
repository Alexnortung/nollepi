import type { WorkflowRunSummary } from "./types";

const ALIGNMENT_STATE_INSTRUCTIONS: Record<string, string[]> = {
	intake: [
		"You are in the intake phase of the alignment workflow.",
		"Your job is to understand the feature or bugfix the human wants to work on.",
		"Ask one clarifying question at a time. Do not start planning or coding yet.",
	],
	"high-level-alignment": [
		"You are in the high-level alignment phase.",
		"Work through alignment categories one at a time: objective, scope, constraints, risks, domain language, approach, open questions.",
		"For each part, ask the human to confirm or deny alignment before marking it complete.",
		"Do not repeat already aligned parts.",
		"Update workflow.md with the current alignment state as you go.",
	],
	"task-proposal": [
		"You are in the task proposal phase.",
		"Create a provisional, complete-looking task list and present it to the human.",
		"Write each task to its task.md file under docs/.workflows/runs/<current-run>/tasks/.",
		"Each task must be commit-worthy and contain enough detail for a fresh agent to implement independently.",
	],
	"task-list-alignment": [
		"You are reviewing the task list with the human.",
		"The human may split, merge, or rewrite tasks. Incorporate all changes.",
		"Update task.md files to reflect any changes.",
		"Only proceed when the human approves the full task list.",
	],
	"task-list-approval": [
		"You are waiting for the human to approve the task list.",
		"Present the final proposed task list clearly. Wait for explicit approval before proceeding.",
	],
	"task-alignment": [
		"You are performing task-level alignment before execution.",
		"Read the current task.md and confirm understanding with the human.",
		"The human may say 'just go' to skip alignment for this task.",
	],
	"task-execution": [
		"You are executing the current task.",
		"Follow the task description in the task.md file exactly.",
		"When done, explain clearly what changed and ask the human to review.",
		"Do not overwrite human manual edits unless explicitly discussed and allowed.",
		"The human may question any change; take all questions seriously.",
	],
	"internal-review": [
		"You have completed execution. Perform an internal review before presenting to the human.",
		"Check that the task.md requirements are met, no human edits were overwritten, and tests pass.",
	],
	"human-review": [
		"You are awaiting human review of the completed task.",
		"Address all human feedback thoroughly. Preserve any manual edits the human made.",
		"When the human approves, update workflow.md to mark the task complete and add the commit hash(es).",
	],
	approved: [
		"The current task has been approved.",
		"Commit the changes if not already committed. Add the commit hash to both workflow.md and task.md.",
		"Then advance workflow.md state to the next task or to wrap-up if all tasks are done.",
	],
	"next-task": [
		"Moving to the next task.",
		"Read the next task.md and begin task-level alignment, or proceed directly if the human said 'just go'.",
	],
	"wrap-up": [
		"The alignment workflow is wrapping up.",
		"Confirm all tasks are committed. Update workflow.md state to 'finish'.",
		"The workflow will be marked done and the human may switch workflows.",
	],
	finish: ["The alignment workflow is complete.", "No further action is needed unless the human asks."],
};

export function buildWorkflowPromptInjection(summary: WorkflowRunSummary): string {
	if (summary.workflow === "base") return "";

	const lines: string[] = [`## Active Workflow: ${summary.workflow}`, "", `Current state: **${summary.state}**`];

	if (summary.currentTask) lines.push(`Current task: ${summary.currentTask}`);
	if (summary.pendingApproval) lines.push(`Pending approval: ${summary.pendingApproval}`);
	lines.push("");

	if (summary.workflow === "alignment") {
		const stateLines = ALIGNMENT_STATE_INSTRUCTIONS[summary.state];
		lines.push(...(stateLines ?? [`Continue with the alignment workflow. State: ${summary.state}.`]));
	} else if (summary.workflow === "autonomous") {
		lines.push(
			"You are in autonomous workflow mode.",
			"Execute with strong authority. Self-review before presenting results.",
			"Proceed automatically to the next step after self-review unless blocked by a hard requirement.",
			"You are operating in an isolated worktree. Command and path guards are relaxed.",
		);
	} else if (summary.workflow === "superpowers") {
		lines.push(
			"You have the Superpowers workflow active.",
			"Follow Superpowers process skills and maintain process discipline throughout.",
		);
	}

	return lines.join("\n");
}
