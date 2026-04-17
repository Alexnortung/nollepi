import type { WorkflowRuntime } from "../state/workflow-state.ts";

export type ReviewCommitIntent = "create" | "existing";

export interface WorkflowTransitionInput {
	state: string;
	commitIntent?: ReviewCommitIntent;
	commitMessage?: string;
	commitHash?: string;
}

export interface WorkflowTransitionEvent {
	previousState: string;
	newState: string;
	commitIntent?: ReviewCommitIntent;
	commitMessage?: string;
	commitHash?: string;
}

export type WorkflowTransitionNormalizationResult =
	| { ok: true; event: WorkflowTransitionEvent }
	| { ok: false; error: string };

function isSuccessfulAlignmentHumanReviewExit(runtime: WorkflowRuntime, newState: string): boolean {
	return (
		runtime.activeWorkflow === "alignment" &&
		runtime.workflowState === "human-review" &&
		(newState === "next-task" || newState === "finish")
	);
}

function hasReviewCommitMetadata(input: WorkflowTransitionInput): boolean {
	return input.commitIntent !== undefined || input.commitMessage !== undefined || input.commitHash !== undefined;
}

export function normalizeWorkflowTransitionEvent(
	runtime: WorkflowRuntime,
	input: WorkflowTransitionInput,
): WorkflowTransitionNormalizationResult {
	const previousState = runtime.workflowState;
	if (!hasReviewCommitMetadata(input)) {
		return {
			ok: true,
			event: {
				previousState,
				newState: input.state,
			},
		};
	}

	if (!isSuccessfulAlignmentHumanReviewExit(runtime, input.state)) {
		return {
			ok: false,
			error: "Commit review metadata is only valid when leaving alignment human-review directly to next-task or finish.",
		};
	}

	const commitIntent = input.commitIntent ?? (input.commitHash ? "existing" : input.commitMessage ? "create" : undefined);

	if (input.commitHash && commitIntent !== "existing") {
		return {
			ok: false,
			error: "commitHash can only be sent when commitIntent is existing.",
		};
	}

	if (input.commitMessage && commitIntent === "existing") {
		return {
			ok: false,
			error: "commitMessage can only be sent when commitIntent is create.",
		};
	}

	return {
		ok: true,
		event: {
			previousState,
			newState: input.state,
			...(commitIntent ? { commitIntent } : {}),
			...(input.commitMessage !== undefined ? { commitMessage: input.commitMessage } : {}),
			...(input.commitHash !== undefined ? { commitHash: input.commitHash } : {}),
		},
	};
}
