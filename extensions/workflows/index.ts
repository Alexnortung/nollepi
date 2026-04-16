import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readTaskStateFromArtifacts } from "./artifacts/reader.ts";
import { MtimeTracker } from "./artifacts/mtime-tracker.ts";
import { writeWorkflowArtifacts } from "./artifacts/writer.ts";
import { getTaskMdPath, getWorkflowMdPath } from "./artifacts/paths.ts";
import { buildWorkflowPrompt } from "./prompts/prompt-builder.ts";
import { restoreState, serializeState, type WorkflowExtensionState } from "./state/persistence.ts";
import { TaskState } from "./state/task-state.ts";
import {
	createWorkflowRuntime,
	type WorkflowName,
	type WorkflowRuntime,
} from "./state/workflow-state.ts";
import { registerTaskCommitTool } from "./tools/task-commit-tool.ts";
import { registerWorkflowStateTool } from "./tools/workflow-info.ts";
import { registerWorkflowSwitchTool } from "./tools/workflow-switch.ts";
import { registerStepManageTool } from "./tools/step-manage-tool.ts";
import { registerTaskManageTool } from "./tools/task-manage-tool.ts";
import { registerWorkflowTransitionTool } from "./tools/workflow-transition.ts";
import { getToolsForWorkflow } from "./tools/tool-sets.ts";

const CUSTOM_ENTRY_TYPE = "workflow-state";

export default function workflowExtension(pi: ExtensionAPI): void {
	let runtime: WorkflowRuntime = createWorkflowRuntime();
	let taskState = new TaskState();
	const mtimeTracker = new MtimeTracker();

	function persistState(): void {
		pi.appendEntry(CUSTOM_ENTRY_TYPE, serializeState(runtime, mtimeTracker.toMap(), taskState));
	}

	function applyToolSet(): void {
		pi.setActiveTools(getToolsForWorkflow(runtime.activeWorkflow, runtime.workflowState));
	}

	async function syncArtifacts(): Promise<void> {
		if (!runtime.runId) return;
		await writeWorkflowArtifacts(process.cwd(), {
			runId: runtime.runId,
			title: taskState.runTitle ?? runtime.runId,
			workflowType: runtime.activeWorkflow,
			workflowState: runtime.workflowState,
			taskState,
		});
		await mtimeTracker.recordMtime(getWorkflowMdPath(runtime.runId));
		await mtimeTracker.recordMtimes(taskState.tasks.map((task) => getTaskMdPath(runtime.runId!, task.id)));
	}

	function updateStatus(ctx: Parameters<Parameters<ExtensionAPI["on"]>[1]>[1]): void {
		if (!ctx.hasUI) return;
		ctx.ui.setStatus(
			"workflow",
			ctx.ui.theme.fg("accent", `⚙ ${runtime.activeWorkflow}`) +
				(runtime.workflowState !== "idle" ? ctx.ui.theme.fg("muted", `:${runtime.workflowState}`) : ""),
		);
	}

	function handleSwitch(_newWorkflow: WorkflowName): void {
		applyToolSet();
		persistState();
	}

	registerWorkflowStateTool(pi, () => runtime, () => taskState);
	registerWorkflowSwitchTool(pi, () => runtime, handleSwitch);
	registerTaskManageTool(pi, () => taskState, () => {
		persistState();
		void syncArtifacts();
	});
	registerStepManageTool(pi, () => taskState, () => {
		persistState();
		void syncArtifacts();
	});
	registerTaskCommitTool(pi, () => taskState, () => {
		persistState();
		void syncArtifacts();
	});
	registerWorkflowTransitionTool(pi, () => runtime, () => {
		applyToolSet();
		persistState();
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
			await mtimeTracker.recordMtime(getWorkflowMdPath(runtime.runId));
			await mtimeTracker.recordMtimes(taskState.tasks.map((task) => getTaskMdPath(runtime.runId!, task.id)));
			persistState();

			if (ctx.hasUI) {
				if (restored.warnings.length > 0) {
					ctx.ui.notify(restored.warnings.join("\n"), "warning");
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
		mtimeTracker.restoreFromMap(restored.artifactMtimes);

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

		return {
			systemPrompt: `${event.systemPrompt}\n\n${buildWorkflowPrompt(runtime)}${taskContext}${changeNotice}`,
		};
	});

	pi.on("turn_end", async (_event, ctx) => {
		updateStatus(ctx);
	});
}
