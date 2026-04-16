export type SubagentRole = "investigator" | "builder" | "reviewer";
export type SubagentRunStatus = "running" | "done" | "error";

export interface SubagentTaskRef {
	id: string;
	summary: string;
	description: string;
	status: string;
}

export interface SubagentStepRef {
	id: string;
	summary: string;
	status: string;
}

export interface CommonDispatchFields {
	role: SubagentRole;
	workflow: string;
	workflowState: string;
	runId?: string;
	task?: SubagentTaskRef;
	step?: SubagentStepRef;
	goal: string;
	hardConstraints: string[];
	priorFindings: string[];
	successTarget: string;
}

export interface InvestigatorPacket extends CommonDispatchFields {
	role: "investigator";
	agreedContext: {
		objective: string[];
		scope: string[];
		constraints: string[];
		approach: string[];
	};
	unresolvedQuestions: string[];
	repoFacingRisks: string[];
}

export interface BuilderPacket extends CommonDispatchFields {
	role: "builder";
	alignedContext: {
		objective: string[];
		scope: string[];
		constraints: string[];
		approach: string[];
		domainLanguage: string[];
	};
	doneCriteria: string[];
}

export interface ReviewerPacket extends CommonDispatchFields {
	role: "reviewer";
	alignedContext: {
		objective: string[];
		scope: string[];
		constraints: string[];
		approach: string[];
	};
	builderSummary?: string;
	changedFiles: string[];
	commits: string[];
	verification: string[];
}

export type SubagentDispatchPacket = InvestigatorPacket | BuilderPacket | ReviewerPacket;

export interface InvestigatorResult {
	role: "investigator";
	findings: string[];
	relevantFiles: string[];
	risks: string[];
	openQuestions: string[];
	suggestedNextAction: string;
}

export interface BuilderResult {
	role: "builder";
	summary: string;
	changedFiles: string[];
	commits: string[];
	verification: string[];
	blockers: string[];
}

export interface ReviewerResult {
	role: "reviewer";
	verdict: "pass" | "needs-changes";
	issues: string[];
	verificationGaps: string[];
	suggestedNextAction: string;
}

export type SubagentResult = InvestigatorResult | BuilderResult | ReviewerResult;

export interface WorkflowSubagentRun {
	id: number;
	role: SubagentRole;
	status: SubagentRunStatus;
	taskId?: string;
	stepId?: string;
	goal: string;
	taskPreview: string;
	startedAt: number;
	finishedAt?: number;
	toolCalls: number;
	outputText: string;
	result?: SubagentResult;
	error?: string;
}

export interface SubagentRunSnapshot {
	nextId: number;
	runs: WorkflowSubagentRun[];
}
