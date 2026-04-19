import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Box, Text } from "@mariozechner/pi-tui";
import * as fs from "node:fs";
import * as path from "node:path";
import { readTaskStateFromArtifacts } from "./artifacts/reader.ts";
import { MtimeTracker } from "./artifacts/mtime-tracker.ts";
import { buildRunId, getRunDir, getStepMdPath, getTaskMdPath, getWorkflowMdPath } from "./artifacts/paths.ts";
import { getRunTitleCandidate, shouldCreateRunArtifacts } from "./artifacts/run-metadata.ts";
import { writeWorkflowArtifacts } from "./artifacts/writer.ts";
import { buildWorkflowPrompt } from "./prompts/prompt-builder.ts";
import { renderSidebar, type SidebarState } from "./sidebar/renderer.ts";
import {
	extractLastOutputLine,
	getVisibleSubagentRuns,
	isTaskOrchestratorVisible,
	renderSubagentCardLines,
	renderTaskOrchestratorCardLines,
	type SubagentWidgetRun,
	type SubagentWidgetTaskOrchestrator,
} from "./sidebar/subagent-widget.ts";
import { AlignmentState } from "./state/alignment-state.ts";
import { restorePersistedWorkflowState, toPersistedWorkflowState } from "./state/persisted-state.ts";
import { ArtifactWorkflowPersistenceBackend } from "./state/artifact-workflow-persistence.ts";
import { SubagentState } from "./state/subagent-state.ts";
import { TaskOrchestratorState, type TaskOrchestratorDispatchRequest, type TaskOrchestratorResult } from "./state/task-orchestrator-state.ts";
import { TaskState } from "./state/task-state.ts";
import type { WorkflowPersistenceRevision } from "./state/workflow-persistence.ts";
import { recordSubagentCompletionSummary } from "./subagents/completion-notifications.ts";
import {
	createWorkflowRuntime,
	type WorkflowName,
	type WorkflowRuntime,
} from "./state/workflow-state.ts";
import { shouldRouteSpecialistResultToTaskOrchestrator } from "./task-orchestrator/follow-up-routing.ts";
import { buildTaskOrchestratorPacket } from "./task-orchestrator/packet-builder.ts";
import { createTaskOrchestratorSessionFile, spawnTaskOrchestratorTurn } from "./task-orchestrator/spawner.ts";
import { spawnSubagentProcess } from "./subagents/spawner.ts";
import { registerAlignmentManageTool } from "./tools/alignment-manage-tool.ts";
import { registerDispatchSubagentTool } from "./tools/dispatch-subagent-tool.ts";
import { registerSubagentMessageRenderers } from "./sidebar/message-renderers.ts";
import { prepareSubagentDispatch, shouldAutoTriggerSubagentResult } from "./tools/dispatch-subagent.ts";
import { registerWorkflowStateTool } from "./tools/workflow-info.ts";
import { registerStepManageTool } from "./tools/step-manage-tool.ts";
import { registerTaskCommitTool } from "./tools/task-commit-tool.ts";
import { registerTaskManageTool } from "./tools/task-manage-tool.ts";
import { getToolsForWorkflow } from "./tools/tool-sets.ts";
import { registerWorkflowSwitchTool } from "./tools/workflow-switch.ts";
import { registerWorkflowTransitionTool } from "./tools/workflow-transition.ts";
import { applyReviewCommit } from "./tools/review-commit.ts";

type WorkflowContext = Parameters<Parameters<ExtensionAPI["on"]>[1]>[1];

export default function workflowExtension(pi: ExtensionAPI): void {
	let runtime: WorkflowRuntime = createWorkflowRuntime();
	let taskState = new TaskState();
	let alignmentState = new AlignmentState();
	let subagentState = new SubagentState();
	let taskOrchestratorState = new TaskOrchestratorState();
	let latestUiContext: WorkflowContext | undefined;
	const workflowPersistence = new ArtifactWorkflowPersistenceBackend(process.cwd());
	let workflowPersistenceRevision: WorkflowPersistenceRevision | undefined;
	let workflowPersistenceSaveQueue = Promise.resolve();
	const activeSubagentWidgetKeys = new Set<string>();
	const mtimeTracker = new MtimeTracker();

	function persistState(): Promise<void> {
		const state = toPersistedWorkflowState(runtime, taskState, alignmentState);
		const saveTask = async (): Promise<void> => {
			const result = await workflowPersistence.save({
				state,
				expectedRevision: workflowPersistenceRevision,
			});
			if (result.ok) {
				workflowPersistenceRevision = result.revision;
				return;
			}
			workflowPersistenceRevision = result.currentRevision;
			console.warn("Workflow persistence save skipped because the stored revision is stale.");
		};
		workflowPersistenceSaveQueue = workflowPersistenceSaveQueue.then(saveTask, saveTask);
		return workflowPersistenceSaveQueue;
	}

	function usesTaskOrchestratorRouting(): boolean {
		return runtime.activeWorkflow === "alignment" && (
			runtime.workflowState === "task-alignment" ||
			runtime.workflowState === "task-execution" ||
			runtime.workflowState === "internal-review" ||
			runtime.workflowState === "human-review"
		);
	}

	function shouldRouteInputToTaskOrchestrator(text: string, source: string): boolean {
		if (source === "extension") return false;
		if (!usesTaskOrchestratorRouting()) return false;
		if (!taskState.getActiveTaskContext().currentTask) return false;
		if (text.trim().startsWith("/")) return false;
		return true;
	}

	async function applyTaskOrchestratorHandoff(result: TaskOrchestratorResult): Promise<void> {
		if (result.status !== "handoff" || !result.requestedTransition) return;
		const active = taskState.getActiveTaskContext();
		if (!active.currentTask) return;

		if (result.outcomeSummary) {
			taskState.recordTaskOutcome(active.currentTask.id, result.outcomeSummary);
		}

		if (result.requestedTransition === "task-execution") {
			taskState.updateTask(active.currentTask.id, { status: "in-progress" });
		}

		if (
			runtime.activeWorkflow === "alignment" &&
			runtime.workflowState === "human-review" &&
			(result.requestedTransition === "next-task" || result.requestedTransition === "finish")
		) {
			const commitResult = applyReviewCommit({
				cwd: process.cwd(),
				taskState,
				taskId: active.currentTask.id,
				commitIntent: result.commitIntent,
				commitMessage: result.commitMessage,
				commitHash: result.commitHash,
			});
			taskState.updateTask(active.currentTask.id, {
				status: commitResult.skipped ? "approved-complete" : "committed",
			});
		}

		runtime.transition(result.requestedTransition);
		if (result.requestedTransition === "next-task" || result.requestedTransition === "finish") {
			if (countActiveTaskSpecialists(active.currentTask.id) > 0) {
				taskOrchestratorState.requestCloseAfterDrain();
			} else {
				taskOrchestratorState.closeSession();
			}
		}
		applyToolSet();
		await persistState();
		await syncArtifacts();
		await persistState();
		refreshUi();
	}

	function countActiveTaskSpecialists(taskId?: string): number {
		return subagentState.getActiveRuns().filter((run) => run.taskId === taskId).length;
	}

	function shouldAutoRouteSpecialistResultToTaskOrchestrator(taskId?: string): boolean {
		return shouldRouteSpecialistResultToTaskOrchestrator(taskOrchestratorState.getSession(), taskId);
	}

	function buildSpecialistFollowUpMessage(runId: number, role: string, result: unknown): string {
		return [
			`Specialist ${role} #${runId} finished for this task.`,
			"Integrate this result and decide the next task-scoped action.",
			"",
			"Structured result:",
			JSON.stringify(result, null, 2),
		].join("\n");
	}

	function scheduleTaskOrchestratorFollowUp(message: string, ctx?: WorkflowContext): void {
		const session = taskOrchestratorState.getSession();
		if (!session || session.status === "closed") return;
		if (session.status === "running") {
			taskOrchestratorState.enqueueFollowUpMessage(message);
			refreshUi();
			return;
		}
		runTaskOrchestratorTurn(message, { ctx });
	}

	function flushQueuedTaskOrchestratorFollowUp(ctx?: WorkflowContext): void {
		const session = taskOrchestratorState.getSession();
		if (!session || session.status !== "waiting") return;
		const nextMessage = taskOrchestratorState.dequeueFollowUpMessage();
		if (!nextMessage) {
			taskOrchestratorState.closeIfDrained(countActiveTaskSpecialists(session.taskId));
			refreshUi();
			return;
		}
		refreshUi();
		runTaskOrchestratorTurn(nextMessage, { ctx });
	}

	function executeTaskOrchestratorDispatchRequests(requests: TaskOrchestratorDispatchRequest[], ctx?: WorkflowContext): void {
		for (const request of requests) {
			try {
				const prepared = prepareSubagentDispatch(
					{
						runtime,
						taskState,
						alignmentState,
						subagentState,
					},
					request,
				);

				// Subagent state is runtime-only, so background streaming updates do not trigger durable saves.
				refreshUi();

				spawnSubagentProcess(pi, ctx?.cwd ?? process.cwd(), prepared.run, prepared.packet, {
					onText: (delta) => {
						subagentState.appendText(prepared.run.id, delta);
						refreshUi();
					},
					onToolCall: () => {
						subagentState.recordToolCall(prepared.run.id);
						refreshUi();
					},
					onFinish: (result) => {
						subagentState.finishRun(prepared.run.id, result, "done");
						refreshUi();
						pi.sendMessage({
							customType: "workflow-subagent-result",
							content: JSON.stringify({ runId: prepared.run.id, role: prepared.run.role, result }, null, 2),
							details: { runId: prepared.run.id, role: prepared.run.role, result },
							display: false,
						}, {
							deliverAs: "followUp",
							triggerTurn: !shouldAutoRouteSpecialistResultToTaskOrchestrator(prepared.run.taskId) && shouldAutoTriggerSubagentResult(runtime.activeWorkflow, latestUiContext?.isIdle() ?? false),
						});
						recordSubagentCompletionSummary(pi, prepared.run);
						refreshUi();
						if (shouldAutoRouteSpecialistResultToTaskOrchestrator(prepared.run.taskId)) {
							scheduleTaskOrchestratorFollowUp(buildSpecialistFollowUpMessage(prepared.run.id, prepared.run.role, result), ctx);
						}
					},
					onError: (message) => {
						subagentState.failRun(prepared.run.id, message);
						refreshUi();
						recordSubagentCompletionSummary(pi, prepared.run, message);
						refreshUi();
						if (shouldAutoRouteSpecialistResultToTaskOrchestrator(prepared.run.taskId)) {
							scheduleTaskOrchestratorFollowUp(
								`A requested ${prepared.run.role} dispatch failed. Explain the failure and decide the next task-scoped action.\n\nError:\n${message}`,
								ctx,
							);
						}
					},
				});
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				pi.sendMessage({
					customType: "workflow-task-orchestrator-message",
					content: `Specialist dispatch request failed: ${message}`,
					display: true,
					details: { error: message, request },
				});
			}
		}
	}

	function runTaskOrchestratorTurn(userMessage: string, options?: { ctx?: WorkflowContext }): void {
		const active = taskState.getActiveTaskContext();
		if (!active.currentTask) return;
		const existing = taskOrchestratorState.getSession();
		if (existing?.status === "running") {
			if (options?.ctx?.hasUI) options.ctx.ui.notify("Task orchestrator is still running.", "warning");
			return;
		}

		const session = taskOrchestratorState.startOrReuseSession({
			taskId: active.currentTask.id,
			taskPreview: active.currentTask.summary,
			sessionFile: existing?.taskId === active.currentTask.id ? existing.sessionFile : createTaskOrchestratorSessionFile(active.currentTask.id),
		});
		taskOrchestratorState.startTurn();
		// Task orchestrator session state is runtime-only, so refresh the UI without writing durable workflow state.
		refreshUi();

		const packet = buildTaskOrchestratorPacket({
			runtime,
			taskState,
			alignmentState,
			subagentState,
		});

		spawnTaskOrchestratorTurn(pi, options?.ctx?.cwd ?? process.cwd(), session, packet, userMessage, {
			onText: (delta) => {
				taskOrchestratorState.appendText(delta);
				refreshUi();
			},
			onToolCall: () => {
				taskOrchestratorState.recordToolCall();
				refreshUi();
			},
			onFinish: (result, displayText) => {
				pi.sendMessage({
					customType: "workflow-task-orchestrator-message",
					content: displayText || result.summary,
					display: true,
					details: {
						taskId: active.currentTask?.id,
						status: result.status,
						requestedTransition: result.requestedTransition,
						dispatchRequestCount: result.dispatchRequests?.length ?? 0,
					},
				});
				void (async () => {
					if (result.status === "handoff" && result.requestedTransition === "task-execution") {
						await applyTaskOrchestratorHandoff(result);
					}
					if (result.dispatchRequests && result.dispatchRequests.length > 0 && result.requestedTransition !== "next-task" && result.requestedTransition !== "finish") {
						executeTaskOrchestratorDispatchRequests(result.dispatchRequests, options?.ctx);
					}
					if (
						result.status === "handoff" &&
						result.requestedTransition &&
						result.requestedTransition !== "task-execution"
					) {
						await applyTaskOrchestratorHandoff(result);
					}
					if (taskOrchestratorState.getSession()?.status !== "closed") {
						taskOrchestratorState.finishTurn(result, displayText);
						refreshUi();
						flushQueuedTaskOrchestratorFollowUp(options?.ctx);
					}
				})().catch((error: unknown) => {
					const message = error instanceof Error ? error.message : String(error);
					taskOrchestratorState.failTurn(message);
					refreshUi();
					if (options?.ctx?.hasUI) options.ctx.ui.notify(`Task orchestrator handoff failed: ${message}`, "error");
				});
			},
			onError: (message) => {
				taskOrchestratorState.failTurn(message);
				refreshUi();
				pi.sendMessage({
					customType: "workflow-task-orchestrator-message",
					content: `Task orchestrator error: ${message}`,
					display: true,
					details: { error: message, taskId: active.currentTask?.id },
				});
			},
		});
	}

	function forwardToTaskOrchestrator(ctx: WorkflowContext, userMessage: string): void {
		runTaskOrchestratorTurn(userMessage, { ctx });
	}

	function applyToolSet(): void {
		pi.setActiveTools(getToolsForWorkflow(runtime.activeWorkflow, runtime.workflowState));
	}

	function refreshUi(): void {
		if (latestUiContext) updateStatus(latestUiContext);
	}

	function usesArtifactRuns(): boolean {
		return runtime.activeWorkflow === "alignment" || runtime.activeWorkflow === "autonomous";
	}

	function getTrackedArtifactPaths(runId: string): string[] {
		return [
			getWorkflowMdPath(runId),
			...taskState.tasks.flatMap((task) => [
				getTaskMdPath(runId, task.id),
				...task.steps
					.filter((step) => step.hasArtifact && step.artifactPath)
					.map((step) => getStepMdPath(runId, task.id, step.artifactPath!.replace(/\.md$/, ""))),
			]),
		];
	}

	function ensureRunMetadata(): boolean {
		if (!usesArtifactRuns()) return false;
		if (!shouldCreateRunArtifacts(runtime.activeWorkflow, runtime.workflowState)) {
			runtime.runId = undefined;
			return false;
		}

		const runTitle = getRunTitleCandidate(taskState, alignmentState);
		if (!runTitle) return false;
		taskState.runTitle ??= runTitle;
		if (runtime.runId) return true;

		for (let ordinal = 1; ordinal < 1000; ordinal += 1) {
			const candidate = buildRunId(runtime.activeWorkflow, taskState.runTitle, new Date(), ordinal);
			if (!fs.existsSync(path.join(process.cwd(), getRunDir(candidate)))) {
				runtime.runId = candidate;
				return true;
			}
		}

		throw new Error(`Unable to allocate workflow run id for ${runtime.activeWorkflow}.`);
	}

	async function recordArtifactMtimes(): Promise<void> {
		mtimeTracker.clear();
		if (!runtime.runId) return;
		await mtimeTracker.recordMtimes(getTrackedArtifactPaths(runtime.runId));
	}

	async function rehydrateArtifactLinkageFromDisk(): Promise<void> {
		if (!runtime.runId || !usesArtifactRuns()) return;
		try {
			const restored = await readTaskStateFromArtifacts(process.cwd(), runtime.runId);
			taskState.rehydrateArtifactLinkage(restored.taskState);
			await recordArtifactMtimes();
		} catch (error: unknown) {
			if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") return;
			console.warn(`Workflow artifact linkage rehydration failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async function syncArtifacts(): Promise<void> {
		if (!usesArtifactRuns()) {
			mtimeTracker.clear();
			return;
		}
		if (!ensureRunMetadata()) {
			mtimeTracker.clear();
			return;
		}
		await writeWorkflowArtifacts(process.cwd(), {
			runId: runtime.runId!,
			title: taskState.runTitle ?? runtime.runId!,
			workflowType: runtime.activeWorkflow,
			workflowState: runtime.workflowState,
			taskState,
		});
		await recordArtifactMtimes();
	}

	function buildSidebarState(): SidebarState {
		const active = taskState.getActiveTaskContext();
		const showAlignment = runtime.activeWorkflow === "alignment" || runtime.activeWorkflow === "autonomous";
		const taskOrchestrator = taskOrchestratorState.getSession();
		return {
			workflow: runtime.activeWorkflow,
			workflowState: runtime.workflowState,
			runId: runtime.runId,
			tasks: taskState.tasks.map((task) => ({
				id: task.id,
				summary: task.summary,
				status: task.status,
				isCurrent: task.id === active.currentTask?.id,
				steps: task.steps.map((step) => ({
					id: step.id,
					summary: step.summary,
					status: step.status,
					isCurrent: step.id === active.currentStep?.id,
				})),
			})),
			alignment: showAlignment
				? {
						...alignmentState.getSummary(),
						categories: alignmentState.categories.map((cat) => ({
							name: cat.name,
							relevance: cat.relevance,
							parts: cat.parts.map((p) => ({ id: p.id, summary: p.summary, state: p.state })),
						})),
					}
				: undefined,
			taskOrchestrator: taskOrchestrator
				? {
						status: taskOrchestrator.status,
						taskPreview: taskOrchestrator.taskPreview,
						elapsedSeconds: Math.max(0, Math.round(((taskOrchestrator.finishedAt ?? Date.now()) - taskOrchestrator.startedAt) / 1000)),
						turnCount: taskOrchestrator.turnCount,
					}
				: undefined,
			subagents: subagentState.runs.map((run) => ({
				id: run.id,
				role: run.role,
				status: run.status,
				taskPreview: run.taskPreview,
				elapsedSeconds: Math.max(0, Math.round(((run.finishedAt ?? Date.now()) - run.startedAt) / 1000)),
			})),
		};
	}

	function buildSubagentWidgetRuns(): SubagentWidgetRun[] {
		return subagentState.runs.map((run) => ({
			id: run.id,
			role: run.role,
			status: run.status,
			goal: run.goal,
			taskPreview: run.taskPreview,
			elapsedSeconds: Math.max(0, Math.round(((run.finishedAt ?? Date.now()) - run.startedAt) / 1000)),
			toolCalls: run.toolCalls,
			lastOutputLine: extractLastOutputLine(run.outputText),
		}));
	}

	function buildSubagentWidgetTaskOrchestrator(): SubagentWidgetTaskOrchestrator | undefined {
		const session = taskOrchestratorState.getSession();
		if (!session) return undefined;
		return {
			status: session.status,
			taskPreview: session.taskPreview,
			elapsedSeconds: Math.max(0, Math.round(((session.finishedAt ?? Date.now()) - session.startedAt) / 1000)),
			turnCount: session.turnCount,
			lastOutputLine: extractLastOutputLine(session.outputText),
		};
	}

	function updateStatus(ctx: WorkflowContext): void {
		latestUiContext = ctx;
		if (!ctx.hasUI) return;
		ctx.ui.setStatus(
			"workflow",
			ctx.ui.theme.fg("accent", `⚙ ${runtime.activeWorkflow}`) +
				(runtime.workflowState !== "idle" ? ctx.ui.theme.fg("muted", `:${runtime.workflowState}`) : ""),
		);

		const sidebarState = buildSidebarState();
		const lines = renderSidebar(sidebarState);
		if (lines.length > 1) {
			ctx.ui.setWidget("workflow-sidebar", lines);
		} else {
			ctx.ui.setWidget("workflow-sidebar", undefined);
		}

		// Per-subagent stacking widgets keyed by run id
		const newWidgetKeys = new Set<string>();

		const widgetTaskOrchestrator = buildSubagentWidgetTaskOrchestrator();
		if (isTaskOrchestratorVisible(widgetTaskOrchestrator)) {
			const key = "wf-task-orch";
			newWidgetKeys.add(key);
			ctx.ui.setWidget(key, (_tui, theme) => {
				const to = buildSubagentWidgetTaskOrchestrator();
				if (!to) return new Text("");
				const lines = renderTaskOrchestratorCardLines(to, theme);
				const box = new Box(1, 0, (t: string) => theme.bg("customMessageBg", t));
				box.addChild(new Text(lines.join("\n")));
				return box;
			});
		}

		const visibleRuns = getVisibleSubagentRuns(buildSubagentWidgetRuns());
		for (const run of visibleRuns) {
			const key = `wf-sub-${run.id}`;
			newWidgetKeys.add(key);
			ctx.ui.setWidget(key, (_tui, theme) => {
				const freshRun = buildSubagentWidgetRuns().find((r) => r.id === run.id);
				if (!freshRun) return new Text("");
				const lines = renderSubagentCardLines(freshRun, theme);
				const box = new Box(1, 0, (t: string) => theme.bg("customMessageBg", t));
				box.addChild(new Text(lines.join("\n")));
				return box;
			});
		}

		// Remove stale widgets
		for (const oldKey of activeSubagentWidgetKeys) {
			if (!newWidgetKeys.has(oldKey)) {
				ctx.ui.setWidget(oldKey, undefined);
			}
		}
		activeSubagentWidgetKeys.clear();
		for (const key of newWidgetKeys) activeSubagentWidgetKeys.add(key);
	}

	function handleSwitch(_newWorkflow: WorkflowName): void {
		applyToolSet();
		persistState();
		void syncArtifacts().then(() => persistState());
		refreshUi();
	}

	registerWorkflowStateTool(pi, () => runtime, () => taskState, () => alignmentState, () => subagentState, () => taskOrchestratorState);
	registerWorkflowSwitchTool(pi, () => runtime, handleSwitch);
	registerSubagentMessageRenderers(pi);
	registerTaskManageTool(pi, () => taskState, () => {
		persistState();
		void syncArtifacts().then(() => persistState());
		refreshUi();
	});
	registerStepManageTool(pi, () => taskState, () => {
		persistState();
		void syncArtifacts().then(() => persistState());
		refreshUi();
	});
	registerTaskCommitTool(pi, () => taskState, () => {
		persistState();
		void syncArtifacts().then(() => persistState());
		refreshUi();
	});
	registerAlignmentManageTool(pi, () => alignmentState, () => {
		persistState();
		void syncArtifacts().then(() => persistState());
		refreshUi();
	});
	registerDispatchSubagentTool(pi, {
		getRuntime: () => runtime,
		getTaskState: () => taskState,
		getAlignmentState: () => alignmentState,
		getSubagentState: () => subagentState,
		persistState,
		requestUiRefresh: refreshUi,
		isIdle: () => latestUiContext?.isIdle() ?? false,
	});
	registerWorkflowTransitionTool(
		pi,
		() => runtime,
		(event) => {
			if (
				runtime.activeWorkflow !== "alignment" ||
				runtime.workflowState !== "human-review" ||
				(event.newState !== "next-task" && event.newState !== "finish")
			) {
				return;
			}

			const active = taskState.getActiveTaskContext();
			if (!active.currentTask) return;

			applyReviewCommit({
				cwd: process.cwd(),
				taskState,
				taskId: active.currentTask.id,
				commitIntent: event.commitIntent,
				commitMessage: event.commitMessage,
				commitHash: event.commitHash,
			});
		},
		(event) => {
			if (event.newState === "next-task" || event.newState === "finish") {
				const active = taskState.getActiveTaskContext();
				if (active.currentTask && countActiveTaskSpecialists(active.currentTask.id) > 0) {
					taskOrchestratorState.requestCloseAfterDrain();
				} else {
					taskOrchestratorState.closeSession();
				}
			}
			applyToolSet();
			persistState();
			void syncArtifacts().then(() => persistState());
			refreshUi();
		},
	);

	pi.registerCommand("workflow", {
		description: "Show or change workflow: /workflow [base|superpowers|alignment|autonomous]",
		handler: async (args, ctx) => {
			const trimmed = args.trim().toLowerCase();
			if (!trimmed) {
				if (ctx.hasUI) {
					ctx.ui.notify(
						`Workflow: ${runtime.activeWorkflow} (state: ${runtime.workflowState})` +
							(runtime.runId ? `\nRun: ${runtime.runId}` : "") +
							`\nCan switch: ${runtime.canSwitch()}`,
						"info",
					);
				}
				return;
			}

			const validWorkflows: WorkflowName[] = ["base", "superpowers", "alignment", "autonomous"];
			if (!validWorkflows.includes(trimmed as WorkflowName)) {
				if (ctx.hasUI) {
					ctx.ui.notify(`Invalid workflow: ${trimmed}. Options: ${validWorkflows.join(", ")}`, "error");
				}
				return;
			}

			const target = trimmed as WorkflowName;
			if (target === runtime.activeWorkflow) {
				if (ctx.hasUI) ctx.ui.notify(`Already in ${target} workflow`, "info");
				return;
			}

			if (!runtime.canSwitch()) {
				if (ctx.hasUI) {
					ctx.ui.notify(
						`Cannot switch from ${runtime.activeWorkflow} (state: ${runtime.workflowState}). Finish the current workflow first.`,
						"warning",
					);
				}
				return;
			}

			runtime.switchTo(target);
			handleSwitch(target);
			updateStatus(ctx);
			if (ctx.hasUI) ctx.ui.notify(`Switched to ${target} workflow`, "info");
		},
	});

	pi.registerCommand("reread", {
		description: "Re-read workflow artifacts and update runtime state from disk",
		handler: async (_args, ctx) => {
			if (!runtime.runId) {
				if (ctx.hasUI) ctx.ui.notify("No active workflow run to re-read.", "info");
				return;
			}

			const restored = await readTaskStateFromArtifacts(process.cwd(), runtime.runId);
			taskState = restored.taskState;
			const warnings = [...restored.warnings];
			if (restored.workflow.workflowType && restored.workflow.workflowType !== runtime.activeWorkflow) {
				warnings.push(
					`Artifact workflow type is ${restored.workflow.workflowType}, but runtime is ${runtime.activeWorkflow}. Keeping runtime workflow.`,
				);
			}
			if (restored.workflow.workflowState) {
				if (runtime.getValidStates().includes(restored.workflow.workflowState)) {
					runtime.workflowState = restored.workflow.workflowState;
					applyToolSet();
				} else {
					warnings.push(
						`Artifact workflow state ${restored.workflow.workflowState} is invalid for ${runtime.activeWorkflow}. Keeping runtime state ${runtime.workflowState}.`,
					);
				}
			}
			await recordArtifactMtimes();
			await persistState();
			refreshUi();

			if (ctx.hasUI) {
				if (warnings.length > 0) {
					ctx.ui.notify(warnings.join("\n"), "warning");
				} else {
					ctx.ui.notify(`Reloaded ${taskState.tasks.length} task(s) from workflow artifacts.`, "info");
				}
			}
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		workflowPersistenceSaveQueue = Promise.resolve();
		const loaded = await workflowPersistence.load();
		workflowPersistenceRevision = loaded?.revision;

		const restored = restorePersistedWorkflowState(loaded?.state);
		runtime = restored.runtime;
		taskState = restored.taskState;
		alignmentState = restored.alignmentState;
		subagentState = new SubagentState();
		taskOrchestratorState = new TaskOrchestratorState();
		mtimeTracker.clear();
		if (usesArtifactRuns() && !shouldCreateRunArtifacts(runtime.activeWorkflow, runtime.workflowState)) {
			runtime.runId = undefined;
			mtimeTracker.clear();
		}
		await rehydrateArtifactLinkageFromDisk();
		latestUiContext = ctx;

		applyToolSet();
		updateStatus(ctx);
		if (ctx.hasUI) ctx.ui.notify("Workflow extension loaded", "info");
	});

	pi.on("input", async (event, ctx) => {
		if (!shouldRouteInputToTaskOrchestrator(event.text, event.source)) {
			return { action: "continue" };
		}
		forwardToTaskOrchestrator(ctx, event.text);
		return { action: "handled" };
	});

	pi.on("before_agent_start", async (event) => {
		const changed = await mtimeTracker.checkForChanges();
		let changeNotice = "";
		if (changed.length > 0) {
			changeNotice =
				"\n\n## Artifact Changes Detected\n" +
				"The following workflow artifacts were modified since the last turn:\n" +
				changed.map((filePath) => `- ${filePath}`).join("\n") +
				"\nConsider using /reread or re-reading these files to update your understanding.";
			await persistState();
		}

		const active = taskState.getActiveTaskContext();
		const taskContext = active.currentTask
			? `\n\n## Active Task Context\n- Current task: ${active.currentTask.id} — ${active.currentTask.summary} [${active.currentTask.status}]${active.currentStep ? `\n- Current step: ${active.currentStep.id} — ${active.currentStep.summary} [${active.currentStep.status}]` : ""}`
			: "";

		const alignmentSummary = alignmentState.getSummary();
		let alignmentContext = "";
		if (runtime.activeWorkflow === "alignment" || runtime.activeWorkflow === "autonomous") {
			const lines: string[] = [
				`\n\n## Alignment Status`,
				`- Aligned: ${alignmentSummary.aligned} | Pending: ${alignmentSummary.pending} | Skipped: ${alignmentSummary.skipped}`,
			];
			for (const cat of alignmentState.categories) {
				lines.push(`### ${cat.name} [${cat.relevance}]`);
				if (cat.relevance === "not-relevant") continue;
				for (const part of cat.parts) {
					lines.push(`- [${part.state}] ${part.id}: ${part.summary}`);
				}
			}
			alignmentContext = lines.join("\n");
		}

		return {
			systemPrompt: `${event.systemPrompt}\n\n${buildWorkflowPrompt(runtime)}${taskContext}${alignmentContext}${changeNotice}`,
		};
	});

	pi.on("turn_end", async (_event, ctx) => {
		updateStatus(ctx);
	});
}
