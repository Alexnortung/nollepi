import type { TaskOutcomeSummary } from "./task-state.ts";

export type TaskOrchestratorStatus = "waiting" | "running" | "error" | "closed";
export type TaskOrchestratorTransitionTarget = "task-execution" | "next-task" | "finish";
export type TaskOrchestratorCommitIntent = "create" | "existing";

export type TaskOrchestratorDispatchRequest =
	| { role: "investigator"; goal: string; successTarget: string }
	| { role: "builder"; goal: string; successTarget: string; doneCriteria: string[] }
	| { role: "reviewer"; goal: string; successTarget: string };

export interface TaskOrchestratorResult {
	status: "continue" | "handoff";
	summary: string;
	dispatchRequests?: TaskOrchestratorDispatchRequest[];
	requestedTransition?: TaskOrchestratorTransitionTarget;
	outcomeSummary?: TaskOutcomeSummary;
	commitIntent?: TaskOrchestratorCommitIntent;
	commitMessage?: string;
	commitHash?: string;
}

export interface TaskOrchestratorSession {
	taskId: string;
	taskPreview: string;
	sessionFile: string;
	status: TaskOrchestratorStatus;
	startedAt: number;
	finishedAt?: number;
	turnCount: number;
	toolCalls: number;
	outputText: string;
	queuedFollowUpMessages: string[];
	pendingCloseAfterDrain: boolean;
	lastDisplayText?: string;
	lastResult?: TaskOrchestratorResult;
	error?: string;
}

export interface TaskOrchestratorSnapshot {
	session?: TaskOrchestratorSession;
}

export class TaskOrchestratorState {
	session?: TaskOrchestratorSession;

	constructor(snapshot?: TaskOrchestratorSnapshot) {
		this.session = snapshot?.session ? structuredClone(snapshot.session) : undefined;
	}

	getSession(): TaskOrchestratorSession | undefined {
		return this.session;
	}

	hasActiveSession(taskId?: string): boolean {
		return !!this.session && this.session.status !== "closed" && (!taskId || this.session.taskId === taskId);
	}

	startOrReuseSession(input: { taskId: string; taskPreview: string; sessionFile: string }): TaskOrchestratorSession {
		if (!this.session || this.session.taskId !== input.taskId || this.session.status === "closed") {
			this.session = {
				taskId: input.taskId,
				taskPreview: input.taskPreview,
				sessionFile: input.sessionFile,
				status: "waiting",
				startedAt: Date.now(),
				turnCount: 0,
				toolCalls: 0,
				outputText: "",
				queuedFollowUpMessages: [],
				pendingCloseAfterDrain: false,
			};
		}
		return this.session;
	}

	startTurn(): TaskOrchestratorSession {
		if (!this.session) throw new Error("No task orchestrator session to start.");
		this.session.turnCount += 1;
		this.session.status = "running";
		this.session.finishedAt = undefined;
		this.session.outputText = "";
		this.session.lastDisplayText = undefined;
		this.session.error = undefined;
		return this.session;
	}

	appendText(text: string): void {
		if (!this.session) throw new Error("No task orchestrator session available.");
		this.session.outputText += text;
	}

	recordToolCall(): void {
		if (!this.session) throw new Error("No task orchestrator session available.");
		this.session.toolCalls += 1;
	}

	enqueueFollowUpMessage(message: string): void {
		if (!this.session) throw new Error("No task orchestrator session available.");
		this.session.queuedFollowUpMessages.push(message);
	}

	dequeueFollowUpMessage(): string | undefined {
		if (!this.session) return undefined;
		return this.session.queuedFollowUpMessages.shift();
	}

	requestCloseAfterDrain(): void {
		if (!this.session) throw new Error("No task orchestrator session available.");
		this.session.pendingCloseAfterDrain = true;
	}

	closeIfDrained(activeSpecialistRuns: number): boolean {
		if (!this.session) return false;
		if (this.session.status === "closed") return false;
		if (!this.session.pendingCloseAfterDrain) return false;
		if (this.session.status !== "waiting") return false;
		if (activeSpecialistRuns > 0) return false;
		if (this.session.queuedFollowUpMessages.length > 0) return false;
		this.closeSession();
		return true;
	}

	finishTurn(result: TaskOrchestratorResult, displayText: string): void {
		if (!this.session) throw new Error("No task orchestrator session available.");
		this.session.status = "waiting";
		this.session.finishedAt = Date.now();
		this.session.lastResult = result;
		this.session.lastDisplayText = displayText;
	}

	failTurn(error: string): void {
		if (!this.session) throw new Error("No task orchestrator session available.");
		this.session.status = "error";
		this.session.finishedAt = Date.now();
		this.session.error = error;
	}

	closeSession(): void {
		if (!this.session) return;
		this.session.status = "closed";
		this.session.pendingCloseAfterDrain = false;
		this.session.finishedAt = Date.now();
	}

	serialize(): TaskOrchestratorSnapshot {
		return {
			session: this.session ? structuredClone(this.session) : undefined,
		};
	}

	static restore(snapshot?: TaskOrchestratorSnapshot): TaskOrchestratorState {
		if (!snapshot?.session) return new TaskOrchestratorState();
		const session = structuredClone(snapshot.session);
		if (session.status === "running") session.status = "waiting";
		session.queuedFollowUpMessages ??= [];
		session.pendingCloseAfterDrain ??= false;
		return new TaskOrchestratorState({ session });
	}
}
