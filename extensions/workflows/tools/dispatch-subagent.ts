import type { AlignmentState } from "../state/alignment-state.ts";
import type { SubagentState } from "../state/subagent-state.ts";
import type { TaskState } from "../state/task-state.ts";
import type { WorkflowRuntime } from "../state/workflow-state.ts";
import { buildDispatchPacket, type DispatchRequest } from "../subagents/packet-builder.ts";

interface DispatchContext {
	runtime: WorkflowRuntime;
	taskState: TaskState;
	alignmentState: AlignmentState;
	subagentState: SubagentState;
}

export function shouldAutoTriggerSubagentResult(workflow: string, isIdle: boolean): boolean {
	return isIdle && (workflow === "alignment" || workflow === "autonomous");
}

export function prepareSubagentDispatch(ctx: DispatchContext, request: DispatchRequest) {
	if (ctx.runtime.activeWorkflow !== "alignment" && ctx.runtime.activeWorkflow !== "autonomous") {
		throw new Error("dispatch_subagent is only valid in alignment or autonomous workflows.");
	}
	if (!ctx.subagentState.canDispatch(request.role)) {
		throw new Error(`A ${request.role} subagent is already running.`);
	}
	const active = ctx.taskState.getActiveTaskContext();
	if ((request.role === "builder" || request.role === "reviewer") && !active.currentTask) {
		throw new Error(`${request.role} dispatch requires an active task.`);
	}

	const packet = buildDispatchPacket(ctx, request);
	const run = ctx.subagentState.startRun({
		role: request.role,
		taskId: active.currentTask?.id,
		stepId: active.currentStep?.id,
		goal: request.goal,
		taskPreview: active.currentTask?.summary ?? request.goal,
	});
	return { run, packet };
}
