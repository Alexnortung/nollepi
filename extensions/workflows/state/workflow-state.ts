export type WorkflowName = "base" | "superpowers" | "alignment" | "autonomous";

const WORKFLOW_STATES: Record<WorkflowName, Record<string, string[]>> = {
	base: {
		idle: ["idle"],
	},
	superpowers: {
		idle: ["design", "planning", "implementing", "reviewing", "finishing", "idle"],
		design: ["planning", "idle"],
		planning: ["implementing", "idle"],
		implementing: ["reviewing", "idle"],
		reviewing: ["finishing", "implementing", "idle"],
		finishing: ["idle"],
	},
	alignment: {
		idle: ["intake"],
		intake: ["high-level-alignment"],
		"high-level-alignment": ["task-proposal"],
		"task-proposal": ["task-list-alignment"],
		"task-list-alignment": ["task-list-approval"],
		"task-list-approval": ["task-alignment", "task-execution", "task-list-alignment"],
		"task-alignment": ["task-execution"],
		"task-execution": ["internal-review"],
		"internal-review": ["human-review"],
		"human-review": ["task-execution", "approved"],
		approved: ["commit"],
		commit: ["next-task", "finish"],
		"next-task": ["task-alignment", "task-execution"],
		finish: ["idle"],
	},
	autonomous: {
		idle: ["intake"],
		intake: ["lightweight-alignment"],
		"lightweight-alignment": ["issue-understanding"],
		"issue-understanding": ["planning"],
		planning: ["task-execution"],
		"task-execution": ["self-review"],
		"self-review": ["verification"],
		verification: ["commit"],
		commit: ["next-step", "pull-request"],
		"next-step": ["task-execution"],
		"pull-request": ["finish"],
		finish: ["idle"],
	},
};

const SWITCHABLE_STATES: Record<WorkflowName, Set<string>> = {
	base: new Set(["idle"]),
	superpowers: new Set(["idle"]),
	alignment: new Set(["idle", "finish"]),
	autonomous: new Set(["idle", "finish"]),
};

export interface WorkflowSnapshot {
	activeWorkflow: WorkflowName;
	workflowState: string;
	runId: string | undefined;
}

export interface WorkflowRuntime {
	activeWorkflow: WorkflowName;
	workflowState: string;
	runId: string | undefined;
	canSwitch(): boolean;
	switchTo(workflow: WorkflowName): void;
	transition(newState: string): void;
	getValidStates(): string[];
	getValidTransitions(): string[];
	serialize(): WorkflowSnapshot;
}

export function createWorkflowRuntime(snapshot?: WorkflowSnapshot): WorkflowRuntime {
	const runtime: WorkflowRuntime = {
		activeWorkflow: snapshot?.activeWorkflow ?? "base",
		workflowState: snapshot?.workflowState ?? "idle",
		runId: snapshot?.runId,

		canSwitch(): boolean {
			return SWITCHABLE_STATES[this.activeWorkflow].has(this.workflowState);
		},

		switchTo(workflow: WorkflowName): void {
			if (!this.canSwitch()) {
				throw new Error(
					`Cannot switch from ${this.activeWorkflow}/${this.workflowState}. Current workflow must be in one of: ${[
						...SWITCHABLE_STATES[this.activeWorkflow],
					].join(", ")}`,
				);
			}
			this.activeWorkflow = workflow;
			this.workflowState = "idle";
			if (workflow === "base") {
				this.runId = undefined;
			}
		},

		transition(newState: string): void {
			const states = WORKFLOW_STATES[this.activeWorkflow];
			if (!(newState in states)) {
				throw new Error(
					`Invalid state "${newState}" for workflow "${this.activeWorkflow}". Valid states: ${Object.keys(states).join(", ")}`,
				);
			}

			const allowed = states[this.workflowState] ?? [];
			if (!allowed.includes(newState)) {
				throw new Error(
					`Cannot transition from "${this.workflowState}" to "${newState}" in workflow "${this.activeWorkflow}". Allowed transitions: ${allowed.join(", ")}`,
				);
			}

			this.workflowState = newState;
		},

		getValidStates(): string[] {
			return Object.keys(WORKFLOW_STATES[this.activeWorkflow]);
		},

		getValidTransitions(): string[] {
			return WORKFLOW_STATES[this.activeWorkflow][this.workflowState] ?? [];
		},

		serialize(): WorkflowSnapshot {
			return {
				activeWorkflow: this.activeWorkflow,
				workflowState: this.workflowState,
				runId: this.runId,
			};
		},
	};

	return runtime;
}
