import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	deriveWorkflowSummaryFromArtifacts as defaultDerive,
	findActiveRun as defaultFindActiveRun,
	switchWorkflow as defaultSwitch,
} from "./shared/artifacts";
import { buildWorkflowPromptInjection } from "./shared/prompt";
import { canStartWorkflow, canSwitchWorkflow } from "./shared/policies";
import { restoreUiStateFromBranch } from "./shared/session";
import { renderWorkflowWidget } from "./shared/sidebar";
import type { WorkflowName, WorkflowRunSummary } from "./shared/types";

type WorkflowDeps = {
	findActiveRun(cwd: string): Promise<string | undefined>;
	deriveWorkflowSummaryFromArtifacts(dir: string): Promise<WorkflowRunSummary>;
	switchWorkflow(input: { cwd: string; workflow: WorkflowName; title?: string }): Promise<WorkflowRunSummary>;
};

const baseIdleSummary: WorkflowRunSummary = { workflow: "base", state: "idle", done: true };

function setWidget(
	ctx: { hasUI: boolean; ui: { setWidget(key: string, lines: string[]): void } },
	summary: WorkflowRunSummary,
) {
	if (!ctx.hasUI) return;
	ctx.ui.setWidget(
		"workflows",
		renderWorkflowWidget({
			workflow: summary.workflow,
			state: summary.state,
			currentTask: summary.currentTask,
			currentStep: summary.currentStep,
			pendingApproval: summary.pendingApproval,
		}),
	);
}

export default function (pi: ExtensionAPI, deps?: Partial<WorkflowDeps>) {
	const findRun = deps?.findActiveRun ?? defaultFindActiveRun;
	const deriveSummary = deps?.deriveWorkflowSummaryFromArtifacts ?? defaultDerive;
	const doSwitch = deps?.switchWorkflow ?? defaultSwitch;

	pi.on("session_start", async (_event, ctx) => {
		const uiState = restoreUiStateFromBranch(ctx.sessionManager.getBranch() as any);
		void uiState;
		const runDirectory = await findRun(ctx.cwd);
		const summary = runDirectory ? await deriveSummary(runDirectory) : baseIdleSummary;
		setWidget(ctx as any, summary);
	});

	pi.registerCommand("workflow", {
		description: "Switch workflow overlays",
		handler: async (args, ctx) => {
			const nextWorkflow = (args.trim() || "base") as WorkflowName;
			const runDirectory = await findRun(ctx.cwd);
			const currentSummary = runDirectory ? await deriveSummary(runDirectory) : baseIdleSummary;

			if (!canSwitchWorkflow({ currentWorkflow: currentSummary.workflow, done: currentSummary.done })) {
				ctx.ui.notify(`Cannot switch from ${currentSummary.workflow} until it is done.`, "error");
				setWidget(ctx as any, currentSummary);
				return;
			}

			const preflight = canStartWorkflow({
				workflow: nextWorkflow,
				sandboxAvailable: Boolean((ctx as any).sandboxAvailable ?? false),
				worktreeReady: Boolean((ctx as any).worktreeReady ?? false),
			});

			if (!preflight.ok) {
				ctx.ui.notify(`${preflight.reason} Fallback options: alignment or base.`, "error");
				setWidget(ctx as any, currentSummary);
				return;
			}

			const nextSummary = await doSwitch({ cwd: ctx.cwd, workflow: nextWorkflow });
			pi.events.emit("workflow:switched", { workflow: nextWorkflow });
			pi.appendEntry("workflow-ui-state", {});
			setWidget(ctx as any, nextSummary);
			ctx.ui.notify(`Switched workflow to ${nextWorkflow}.`, "info");
		},
	});

	pi.on("before_agent_start", async (event, ctx) => {
		const runDirectory = await findRun(ctx.cwd);
		const summary = runDirectory ? await deriveSummary(runDirectory) : baseIdleSummary;
		const injection = buildWorkflowPromptInjection(summary);
		if (!injection) return;
		return { systemPrompt: `${event.systemPrompt}\n\n${injection}` };
	});

	pi.on("tool_result", async (event, ctx) => {
		if (event.toolName !== "write" && event.toolName !== "edit") return;
		const writtenPath = (event.input as { path?: string }).path;
		if (!writtenPath) return;

		const isWorkflowArtifact =
			writtenPath.includes("docs/.workflows/runs") &&
			(writtenPath.endsWith("workflow.md") || writtenPath.endsWith("task.md"));
		if (!isWorkflowArtifact) return;

		const runDirectory = await findRun(ctx.cwd);
		if (!runDirectory) return;
		try {
			const summary = await deriveSummary(runDirectory);
			setWidget(ctx as any, summary);
		} catch {
			// Ignore parse errors during agent writes — file may be partially written
		}
	});
}
