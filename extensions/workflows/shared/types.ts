export type WorkflowName = "base" | "superpowers" | "alignment" | "autonomous";

export type ApprovalSurface = "alignment" | "task-list" | "task-completion";

export type WorkflowRunSummary = {
	workflow: WorkflowName;
	runDirectory?: string;
	state: string;
	done: boolean;
	pendingApproval?: ApprovalSurface;
	currentTask?: string;
	currentStep?: string;
};

export type WorkflowUiState = {
	expandedTaskIds?: string[];
	expandedAlignmentPartIds?: string[];
	selectedTaskId?: string;
	selectedStepId?: string;
	widgetMode?: "compact" | "expanded";
};
