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
