import type { TaskOutcomeSummary } from "./task-state.ts";

export type TaskOrchestratorStatus = "waiting" | "running" | "error" | "closed";
export type TaskOrchestratorTransitionTarget = "task-execution" | "next-task" | "finish";
export type TaskOrchestratorCommitIntent = "create" | "existing";

export interface TaskOrchestratorResult {
	status: "continue" | "handoff";
	summary: string;
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
		return new TaskOrchestratorState({ session });
	}
}
