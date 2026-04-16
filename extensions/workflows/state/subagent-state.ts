import type {
	SubagentResult,
	SubagentRole,
	SubagentRunSnapshot,
	WorkflowSubagentRun,
} from "../subagents/contracts.ts";

export class SubagentState {
	runs: WorkflowSubagentRun[];
	private nextId: number;

	constructor(snapshot?: SubagentRunSnapshot) {
		this.nextId = snapshot?.nextId ?? 1;
		this.runs = snapshot?.runs ? structuredClone(snapshot.runs) : [];
	}

	canDispatch(role: SubagentRole): boolean {
		return !this.runs.some((run) => run.role === role && run.status === "running");
	}

	startRun(input: {
		role: SubagentRole;
		taskId?: string;
		stepId?: string;
		goal: string;
		taskPreview: string;
	}): WorkflowSubagentRun {
		if (!this.canDispatch(input.role)) {
			throw new Error(`A ${input.role} subagent is already running.`);
		}

		const run: WorkflowSubagentRun = {
			id: this.nextId++,
			role: input.role,
			status: "running",
			taskId: input.taskId,
			stepId: input.stepId,
			goal: input.goal,
			taskPreview: input.taskPreview,
			startedAt: Date.now(),
			toolCalls: 0,
			outputText: "",
		};
		this.runs.push(run);
		return run;
	}

	getRun(id: number): WorkflowSubagentRun | undefined {
		return this.runs.find((run) => run.id === id);
	}

	getActiveRuns(): WorkflowSubagentRun[] {
		return this.runs.filter((run) => run.status === "running");
	}

	appendText(id: number, text: string): void {
		const run = this.getRun(id);
		if (!run) throw new Error(`Unknown subagent run: ${id}`);
		run.outputText += text;
	}

	recordToolCall(id: number): void {
		const run = this.getRun(id);
		if (!run) throw new Error(`Unknown subagent run: ${id}`);
		run.toolCalls += 1;
	}

	finishRun(id: number, result: SubagentResult, status: "done" | "error", error?: string): void {
		const run = this.getRun(id);
		if (!run) throw new Error(`Unknown subagent run: ${id}`);
		run.status = status;
		run.result = result;
		run.error = error;
		run.finishedAt = Date.now();
	}

	failRun(id: number, error: string): void {
		const run = this.getRun(id);
		if (!run) throw new Error(`Unknown subagent run: ${id}`);
		run.status = "error";
		run.error = error;
		run.finishedAt = Date.now();
	}

	getInvestigatorFindings(taskId?: string): string[] {
		return this.runs
			.filter((run) => run.role === "investigator" && run.status === "done" && run.taskId === taskId)
			.flatMap((run) => (run.result?.role === "investigator" ? run.result.findings : []));
	}

	getLatestBuilderResult(taskId?: string) {
		return [...this.runs]
			.reverse()
			.find((run) => run.role === "builder" && run.status === "done" && run.taskId === taskId)?.result;
	}

	serialize(): SubagentRunSnapshot {
		return {
			nextId: this.nextId,
			runs: structuredClone(this.runs),
		};
	}

	static restore(snapshot?: SubagentRunSnapshot): SubagentState {
		if (!snapshot) return new SubagentState();
		return new SubagentState({
			nextId: snapshot.nextId,
			runs: snapshot.runs.filter((run) => run.status !== "running"),
		});
	}
}
