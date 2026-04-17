import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import { readTaskStateFromArtifacts } from "./artifacts/reader.ts";
import { MtimeTracker } from "./artifacts/mtime-tracker.ts";
import { buildRunId, getRunDir, getStepMdPath, getTaskMdPath, getWorkflowMdPath } from "./artifacts/paths.ts";
import { getRunTitleCandidate, shouldCreateRunArtifacts } from "./artifacts/run-metadata.ts";
import { writeWorkflowArtifacts } from "./artifacts/writer.ts";
import { buildWorkflowPrompt } from "./prompts/prompt-builder.ts";
import { renderSidebar, type SidebarState } from "./sidebar/renderer.ts";
import { AlignmentState } from "./state/alignment-state.ts";
import { restoreState, serializeState, type WorkflowExtensionState } from "./state/persistence.ts";
import { SubagentState } from "./state/subagent-state.ts";
import { TaskState } from "./state/task-state.ts";
import {
	createWorkflowRuntime,
	type WorkflowName,
	type WorkflowRuntime,
} from "./state/workflow-state.ts";
import { registerAlignmentManageTool } from "./tools/alignment-manage-tool.ts";
import { registerDispatchSubagentTool } from "./tools/dispatch-subagent-tool.ts";
import { registerWorkflowStateTool } from "./tools/workflow-info.ts";
import { registerStepManageTool } from "./tools/step-manage-tool.ts";
import { registerTaskCommitTool } from "./tools/task-commit-tool.ts";
import { registerTaskManageTool } from "./tools/task-manage-tool.ts";
import { getToolsForWorkflow } from "./tools/tool-sets.ts";
import { registerWorkflowSwitchTool } from "./tools/workflow-switch.ts";
import { registerWorkflowTransitionTool } from "./tools/workflow-transition.ts";

const CUSTOM_ENTRY_TYPE = "workflow-state";

type WorkflowContext = Parameters<Parameters<ExtensionAPI["on"]>[1]>[1];

export default function workflowExtension(pi: ExtensionAPI): void {
	let runtime: WorkflowRuntime = createWorkflowRuntime();
	let taskState = new TaskState();
	let alignmentState = new AlignmentState();
	let subagentState = new SubagentState();
	let latestUiContext: WorkflowContext | undefined;
	const mtimeTracker = new MtimeTracker();

	function persistState(): void {
		pi.appendEntry(
			CUSTOM_ENTRY_TYPE,
			serializeState(runtime, mtimeTracker.toMap(), taskState, alignmentState, subagentState),
		);
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
			subagents: subagentState.runs.map((run) => ({
				id: run.id,
				role: run.role,
				status: run.status,
				taskPreview: run.taskPreview,
				elapsedSeconds: Math.max(0, Math.round(((run.finishedAt ?? Date.now()) - run.startedAt) / 1000)),
			})),
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
	}

	function handleSwitch(_newWorkflow: WorkflowName): void {
		applyToolSet();
		persistState();
		void syncArtifacts().then(() => persistState());
		refreshUi();
	}

	registerWorkflowStateTool(pi, () => runtime, () => taskState, () => alignmentState, () => subagentState);
	registerWorkflowSwitchTool(pi, () => runtime, handleSwitch);
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
	registerWorkflowTransitionTool(pi, () => runtime, (_event) => {
		applyToolSet();
		persistState();
		void syncArtifacts().then(() => persistState());
		refreshUi();
	});

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
			persistState();
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
		const entries = ctx.sessionManager.getEntries();
		const lastEntry = entries
			.filter((entry: { type: string; customType?: string }) => entry.type === "custom" && entry.customType === CUSTOM_ENTRY_TYPE)
			.pop() as { data?: WorkflowExtensionState } | undefined;

		const restored = restoreState(lastEntry?.data);
		runtime = restored.runtime;
		taskState = restored.taskState;
		alignmentState = restored.alignmentState;
		subagentState = restored.subagentState;
		mtimeTracker.restoreFromMap(restored.artifactMtimes);
		if (usesArtifactRuns() && !shouldCreateRunArtifacts(runtime.activeWorkflow, runtime.workflowState)) {
			runtime.runId = undefined;
			mtimeTracker.clear();
		}
		latestUiContext = ctx;

		applyToolSet();
		updateStatus(ctx);
		if (ctx.hasUI) ctx.ui.notify("Workflow extension loaded", "info");
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
			persistState();
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
