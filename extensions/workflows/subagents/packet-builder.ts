import type { AlignmentCategory, AlignmentState } from "../state/alignment-state.ts";
import type { SubagentState } from "../state/subagent-state.ts";
import type { TaskState } from "../state/task-state.ts";
import type { WorkflowRuntime } from "../state/workflow-state.ts";
import type {
	BuilderPacket,
	InvestigatorPacket,
	ReviewerPacket,
	SubagentDispatchPacket,
} from "./contracts.ts";

export type DispatchRequest =
	| { role: "investigator"; goal: string; successTarget: string }
	| { role: "builder"; goal: string; successTarget: string; doneCriteria: string[] }
	| { role: "reviewer"; goal: string; successTarget: string };

interface BuildPacketContext {
	runtime: WorkflowRuntime;
	taskState: TaskState;
	alignmentState: AlignmentState;
	subagentState: SubagentState;
}

function alignedSummaries(categories: AlignmentCategory[], categoryName: string): string[] {
	return categories
		.find((category) => category.name === categoryName)
		?.parts.filter((part) => part.state === "aligned")
		.map((part) => part.summary) ?? [];
}

function unresolvedSummaries(categories: AlignmentCategory[], categoryName: string): string[] {
	return categories
		.find((category) => category.name === categoryName)
		?.parts.filter((part) => part.state !== "aligned" && part.state !== "skipped" && part.state !== "not-relevant")
		.map((part) => part.summary) ?? [];
}

export function buildDispatchPacket(
	ctx: BuildPacketContext,
	request: DispatchRequest,
): SubagentDispatchPacket {
	const active = ctx.taskState.getActiveTaskContext();
	const task = active.currentTask
		? {
				id: active.currentTask.id,
				summary: active.currentTask.summary,
				description: active.currentTask.description,
				status: active.currentTask.status,
			}
		: undefined;
	const step = active.currentStep
		? { id: active.currentStep.id, summary: active.currentStep.summary, status: active.currentStep.status }
		: undefined;
	const common = {
		role: request.role,
		workflow: ctx.runtime.activeWorkflow,
		workflowState: ctx.runtime.workflowState,
		runId: ctx.runtime.runId,
		task,
		step,
		goal: request.goal,
		hardConstraints: alignedSummaries(ctx.alignmentState.categories, "constraints"),
		priorFindings: ctx.subagentState.getInvestigatorFindings(task?.id),
		successTarget: request.successTarget,
	} as const;

	switch (request.role) {
		case "investigator": {
			const packet: InvestigatorPacket = {
				...common,
				role: "investigator",
				agreedContext: {
					objective: alignedSummaries(ctx.alignmentState.categories, "objective"),
					scope: alignedSummaries(ctx.alignmentState.categories, "scope"),
					constraints: alignedSummaries(ctx.alignmentState.categories, "constraints"),
					approach: alignedSummaries(ctx.alignmentState.categories, "approach"),
				},
				unresolvedQuestions: unresolvedSummaries(ctx.alignmentState.categories, "open-questions"),
				repoFacingRisks: unresolvedSummaries(ctx.alignmentState.categories, "risks"),
			};
			return packet;
		}
		case "builder": {
			const packet: BuilderPacket = {
				...common,
				role: "builder",
				alignedContext: {
					objective: alignedSummaries(ctx.alignmentState.categories, "objective"),
					scope: alignedSummaries(ctx.alignmentState.categories, "scope"),
					constraints: alignedSummaries(ctx.alignmentState.categories, "constraints"),
					approach: alignedSummaries(ctx.alignmentState.categories, "approach"),
					domainLanguage: alignedSummaries(ctx.alignmentState.categories, "domain-language"),
				},
				doneCriteria: request.doneCriteria,
			};
			return packet;
		}
		case "reviewer": {
			const latestBuilder = ctx.subagentState.getLatestBuilderResult(task?.id);
			const packet: ReviewerPacket = {
				...common,
				role: "reviewer",
				alignedContext: {
					objective: alignedSummaries(ctx.alignmentState.categories, "objective"),
					scope: alignedSummaries(ctx.alignmentState.categories, "scope"),
					constraints: alignedSummaries(ctx.alignmentState.categories, "constraints"),
					approach: alignedSummaries(ctx.alignmentState.categories, "approach"),
				},
				builderSummary: latestBuilder?.role === "builder" ? latestBuilder.summary : undefined,
				changedFiles: latestBuilder?.role === "builder" ? latestBuilder.changedFiles : [],
				commits: latestBuilder?.role === "builder" ? latestBuilder.commits : [],
				verification: latestBuilder?.role === "builder" ? latestBuilder.verification : [],
			};
			return packet;
		}
	}
}
