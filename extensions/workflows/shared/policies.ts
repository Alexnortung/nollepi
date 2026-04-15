import type { WorkflowName } from "./types";

export function canSwitchWorkflow(input: { currentWorkflow: WorkflowName; done: boolean }) {
	if (input.currentWorkflow === "base") return true;
	return input.done;
}

export function requiresSandbox(workflow: WorkflowName) {
	return workflow === "autonomous";
}

export function getGuardPolicy(workflow: WorkflowName) {
	if (workflow === "autonomous") {
		return { commandGuard: false, pathGuard: false };
	}
	return { commandGuard: true, pathGuard: true };
}

export function canStartWorkflow(input: {
	workflow: WorkflowName;
	sandboxAvailable: boolean;
	worktreeReady: boolean;
}) {
	if (input.workflow !== "autonomous") return { ok: true as const };
	if (!input.sandboxAvailable) return { ok: false as const, reason: "Sandboxing must be available for autonomous workflow." };
	if (!input.worktreeReady) return { ok: false as const, reason: "An isolated worktree is required for autonomous workflow." };
	return { ok: true as const };
}
