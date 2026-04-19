import type { CategoryRelevance, PartState } from "./alignment-state.ts";
import type { StepStatus, TaskStatus } from "./task-state.ts";
import type { WorkflowName } from "./workflow-state.ts";

/**
 * Opaque compare-and-set token produced by a persistence backend.
 * Callers should treat revisions as equality-only values.
 */
export type WorkflowPersistenceRevision = string;

/**
 * Durable workflow-owned data shared across persistence backends.
 *
 * This model deliberately excludes backend details such as file paths, mtimes,
 * markdown-specific fields, subagent state, and task-orchestrator session state.
 */
export interface PersistedWorkflowState {
	workflow: WorkflowName;
	workflowState: string;
	runId?: string;
	runTitle?: string;
	runSlug?: string;
	currentTaskId?: string;
	currentStepId?: string;
	tasks: PersistedWorkflowTask[];
	alignment: PersistedAlignmentState;
}

export interface PersistedTaskOutcomeSummary {
	changedFiles: string[];
	relevantSymbols: string[];
	notes: string[];
}

export interface PersistedWorkflowTask {
	id: string;
	summary: string;
	description: string;
	status: TaskStatus;
	alignmentRequired: boolean;
	commitHashes: string[];
	outcomeSummary?: PersistedTaskOutcomeSummary;
	steps: PersistedWorkflowStep[];
}

export interface PersistedWorkflowStep {
	id: string;
	summary: string;
	description: string;
	status: StepStatus;
}

export interface PersistedAlignmentState {
	categories: PersistedAlignmentCategory[];
}

export interface PersistedAlignmentCategory {
	name: string;
	relevance: CategoryRelevance;
	parts: PersistedAlignmentPart[];
}

export interface PersistedAlignmentPart {
	id: string;
	summary: string;
	details: string;
	state: PartState;
}

export interface WorkflowPersistenceLoadResult {
	revision: WorkflowPersistenceRevision;
	state: PersistedWorkflowState;
}

export interface WorkflowPersistenceSaveInput {
	state: PersistedWorkflowState;
	expectedRevision?: WorkflowPersistenceRevision;
}

export interface WorkflowPersistenceSaveSuccess {
	ok: true;
	revision: WorkflowPersistenceRevision;
}

export interface WorkflowPersistenceSaveStale {
	ok: false;
	reason: "stale";
	currentRevision?: WorkflowPersistenceRevision;
}

export type WorkflowPersistenceSaveResult =
	| WorkflowPersistenceSaveSuccess
	| WorkflowPersistenceSaveStale;

export interface WorkflowPersistenceChange {
	revision?: WorkflowPersistenceRevision;
}

export interface WorkflowPersistenceWatchHandle {
	close(): void;
}

export type WorkflowPersistenceChangeListener = (
	change: WorkflowPersistenceChange,
) => void;

export interface WorkflowPersistenceBackend {
	load(): Promise<WorkflowPersistenceLoadResult | undefined>;
	save(
		input: WorkflowPersistenceSaveInput,
	): Promise<WorkflowPersistenceSaveResult>;
	isStale(revision: WorkflowPersistenceRevision | undefined): Promise<boolean>;
	watch?(
		listener: WorkflowPersistenceChangeListener,
	): Promise<WorkflowPersistenceWatchHandle>;
}
