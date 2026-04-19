import { describe, it } from "node:test";
import assert from "node:assert/strict";
import "../../extensions/workflows/state/workflow-persistence.ts";
import type {
	PersistedAlignmentState,
	PersistedTaskOutcomeSummary,
	PersistedWorkflowState,
	PersistedWorkflowStep,
	PersistedWorkflowTask,
	WorkflowPersistenceBackend,
	WorkflowPersistenceChange,
	WorkflowPersistenceRevision,
	WorkflowPersistenceSaveInput,
	WorkflowPersistenceSaveResult,
} from "../../extensions/workflows/state/workflow-persistence.ts";

type Assert<T extends true> = T;
type OmitsKeys<T, K extends PropertyKey> = Extract<K, keyof T> extends never ? true : false;

type _WorkflowOmitsBackendDetails = Assert<
	OmitsKeys<PersistedWorkflowState, "artifactMtimes" | "subagents" | "taskOrchestrator" | "workflowPath" | "mtime">
>;
type _TaskOmitsFileDetails = Assert<OmitsKeys<PersistedWorkflowTask, "taskDir" | "taskMdPath">>;
type _OutcomeSummaryOmitsBackendDetails = Assert<
	OmitsKeys<PersistedTaskOutcomeSummary, "artifactPath" | "sessionFile" | "taskMdPath" | "taskDir">
>;
type _StepOmitsArtifactDetails = Assert<
	OmitsKeys<PersistedWorkflowStep, "hasArtifact" | "artifactPath">
>;
type _AlignmentOmitsBackendDetails = Assert<OmitsKeys<PersistedAlignmentState, "markdown" | "path">>;

function createPersistedWorkflowState(): PersistedWorkflowState {
	return {
		workflow: "alignment",
		workflowState: "task-execution",
		runId: "2026-04-19-01-alignment-refactor-the-workflow-extension",
		runTitle: "Workflow persistence refactor",
		runSlug: "workflow-persistence-refactor",
		currentTaskId: "02-define-workflow-persistence-interface",
		currentStepId: "step-1",
		tasks: [
			{
				id: "02-define-workflow-persistence-interface",
				summary: "Define workflow persistence interface",
				description: "Add a backend-agnostic persistence contract for durable workflow data.",
				status: "in-progress",
				alignmentRequired: true,
				commitHashes: ["abc123"],
				outcomeSummary: {
					changedFiles: [
						"extensions/workflows/state/workflow-persistence.ts",
						"tests/workflows/workflow-persistence.test.ts",
					],
					relevantSymbols: ["PersistedWorkflowTask", "PersistedTaskOutcomeSummary"],
					notes: ["Persist durable task outcome summaries without backend-specific fields."],
				},
				steps: [
					{
						id: "step-1",
						summary: "Define persisted workflow types",
						description: "Describe durable workflow, task, step, and alignment data.",
						status: "done",
					},
				],
			},
		],
		alignment: {
			categories: [
				{
					name: "constraints",
					relevance: "relevant",
					parts: [
						{
							id: "part-1",
							summary: "Do not persist subagents",
							details: "Persist workflow state, tasks, steps, and alignment only.",
							state: "aligned",
						},
					],
				},
			],
		},
	};
}

class MemoryWorkflowPersistenceBackend implements WorkflowPersistenceBackend {
	protected stored?: { revision: WorkflowPersistenceRevision; state: PersistedWorkflowState };
	private nextRevision = 1;

	async load() {
		return this.stored ? structuredClone(this.stored) : undefined;
	}

	async save(input: WorkflowPersistenceSaveInput): Promise<WorkflowPersistenceSaveResult> {
		const currentRevision = this.stored?.revision;
		if (currentRevision !== input.expectedRevision) {
			if (currentRevision !== undefined || input.expectedRevision !== undefined) {
				return { ok: false, reason: "stale", currentRevision };
			}
		}

		const revision = `rev-${this.nextRevision++}`;
		this.stored = {
			revision,
			state: structuredClone(input.state),
		};
		this.onSaved({ revision });
		return { ok: true, revision };
	}

	async isStale(revision: WorkflowPersistenceRevision | undefined): Promise<boolean> {
		return this.stored?.revision !== revision;
	}

	protected onSaved(_change: WorkflowPersistenceChange): void {}
}

class WatchableMemoryWorkflowPersistenceBackend extends MemoryWorkflowPersistenceBackend {
	private listeners = new Set<(change: WorkflowPersistenceChange) => void>();

	async watch(listener: (change: WorkflowPersistenceChange) => void) {
		this.listeners.add(listener);
		return {
			close: () => {
				this.listeners.delete(listener);
			},
		};
	}

	protected override onSaved(change: WorkflowPersistenceChange): void {
		for (const listener of this.listeners) {
			listener(change);
		}
	}
}

function runWorkflowPersistenceBackendContract(
	label: string,
	createBackend: () => WorkflowPersistenceBackend,
): void {
	describe(label, () => {
		it("exposes load/save/isStale and stores backend-neutral workflow data", async () => {
			const backend = createBackend();
			assert.equal(typeof backend.load, "function");
			assert.equal(typeof backend.save, "function");
			assert.equal(typeof backend.isStale, "function");

			const initial = await backend.load();
			assert.equal(initial, undefined);
			assert.equal(await backend.isStale(undefined), false);

			const state = createPersistedWorkflowState();
			const firstSave = await backend.save({ state, expectedRevision: undefined });
			assert.deepEqual(firstSave, { ok: true, revision: "rev-1" });

			const loaded = await backend.load();
			assert.deepEqual(loaded, { revision: "rev-1", state });
			assert.equal(await backend.isStale("rev-1"), false);
			assert.equal(await backend.isStale(undefined), true);
		});

		it("rejects stale saves and advances the revision after a successful compare-and-set save", async () => {
			const backend = createBackend();
			const state = createPersistedWorkflowState();

			const firstSave = await backend.save({ state, expectedRevision: undefined });
			assert.equal(firstSave.ok, true);
			if (!firstSave.ok) throw new Error("expected first save to succeed");

			const staleSave = await backend.save({
				state: { ...state, runTitle: "stale update" },
				expectedRevision: undefined,
			});
			assert.deepEqual(staleSave, { ok: false, reason: "stale", currentRevision: firstSave.revision });

			const secondSave = await backend.save({
				state: { ...state, workflowState: "internal-review" },
				expectedRevision: firstSave.revision,
			});
			assert.deepEqual(secondSave, { ok: true, revision: "rev-2" });

			const loaded = await backend.load();
			assert.deepEqual(loaded, {
				revision: "rev-2",
				state: { ...state, workflowState: "internal-review" },
			});
			assert.equal(await backend.isStale(firstSave.revision), true);
			assert.equal(await backend.isStale("rev-2"), false);
		});

		it("persists durable task outcome summaries as part of task data", async () => {
			const backend = createBackend();
			const state = createPersistedWorkflowState();
			const expectedOutcomeSummary = state.tasks[0].outcomeSummary;

			assert.ok(expectedOutcomeSummary !== undefined);

			const firstSave = await backend.save({ state, expectedRevision: undefined });
			assert.equal(firstSave.ok, true);

			const loaded = await backend.load();
			assert.ok(loaded !== undefined);
			assert.deepEqual(loaded.state.tasks[0].outcomeSummary, expectedOutcomeSummary);
			assert.equal("taskDir" in loaded.state.tasks[0].outcomeSummary, false);
			assert.equal("sessionFile" in loaded.state.tasks[0].outcomeSummary, false);
		});

		it("treats watch support as optional", async () => {
			const backend = createBackend();
			if (!backend.watch) {
				assert.equal(backend.watch, undefined);
				return;
			}

			const changes: WorkflowPersistenceChange[] = [];
			const subscription = await backend.watch((change) => {
				changes.push(change);
			});
			const state = createPersistedWorkflowState();

			await backend.save({ state, expectedRevision: undefined });
			assert.deepEqual(changes, [{ revision: "rev-1" }]);

			subscription.close();
			await backend.save({ state: { ...state, workflowState: "human-review" }, expectedRevision: "rev-1" });
			assert.deepEqual(changes, [{ revision: "rev-1" }]);
		});
	});
}

describe("workflow persistence contract", () => {
	it("defines a durable workflow snapshot without backend-specific fields", () => {
		const state = createPersistedWorkflowState();
		assert.equal(state.workflow, "alignment");
		assert.equal(state.tasks[0].alignmentRequired, true);
		assert.deepEqual(state.tasks[0].outcomeSummary?.changedFiles, [
			"extensions/workflows/state/workflow-persistence.ts",
			"tests/workflows/workflow-persistence.test.ts",
		]);
		assert.equal("taskDir" in state.tasks[0], false);
		assert.equal("sessionFile" in (state.tasks[0].outcomeSummary ?? {}), false);
		assert.equal("artifactPath" in state.tasks[0].steps[0], false);
		assert.equal("subagents" in state, false);
	});

	runWorkflowPersistenceBackendContract("memory backend", () => new MemoryWorkflowPersistenceBackend());
	runWorkflowPersistenceBackendContract("watchable memory backend", () => new WatchableMemoryWorkflowPersistenceBackend());
});
