import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { deriveWorkflowSummaryFromArtifacts, findActiveRun, switchWorkflow } from "./shared/artifacts";
import { canSwitchWorkflow } from "./shared/policies";
import { restoreUiStateFromBranch } from "./shared/session";
import { renderWorkflowWidget } from "./shared/sidebar";
import type { WorkflowName, WorkflowRunSummary } from "./shared/types";

function setWidget(ctx: { hasUI: boolean; ui: { setWidget(key: string, lines: string[]): void } }, summary: WorkflowRunSummary) {
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

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		restoreUiStateFromBranch(ctx.sessionManager.getBranch() as any);
		const runDirectory = "workflowArtifacts" in ctx ? await (ctx as any).workflowArtifacts.findActiveRun() : await findActiveRun(ctx.cwd);
		if (!runDirectory) return;
		const summary =
			"workflowArtifacts" in ctx
				? await (ctx as any).workflowArtifacts.deriveWorkflowSummaryFromArtifacts(runDirectory)
				: await deriveWorkflowSummaryFromArtifacts(runDirectory);
		setWidget(ctx as any, summary);
	});

	pi.registerCommand("workflow", {
		description: "Switch workflow overlays",
		handler: async (args, ctx) => {
			const nextWorkflow = (args.trim() || "base") as WorkflowName;
			const runDirectory =
				"workflowArtifacts" in ctx ? await (ctx as any).workflowArtifacts.findActiveRun() : await findActiveRun(ctx.cwd);
			const currentSummary = runDirectory
				? "workflowArtifacts" in ctx
					? await (ctx as any).workflowArtifacts.deriveWorkflowSummaryFromArtifacts(runDirectory)
					: await deriveWorkflowSummaryFromArtifacts(runDirectory)
				: { workflow: "base" as const, state: "idle", done: true };

			if (!canSwitchWorkflow({ currentWorkflow: currentSummary.workflow, done: currentSummary.done })) {
				ctx.ui.notify(`Cannot switch from ${currentSummary.workflow} until it is done.`, "error");
				setWidget(ctx as any, currentSummary);
				return;
			}

			const nextSummary =
				"workflowArtifacts" in ctx
					? await (ctx as any).workflowArtifacts.switchWorkflow(nextWorkflow)
					: await switchWorkflow({ cwd: ctx.cwd, workflow: nextWorkflow });

			pi.appendEntry("workflow-ui-state", {});
			setWidget(ctx as any, nextSummary);
			ctx.ui.notify(`Switched workflow to ${nextWorkflow}.`, "info");
		},
	});
}
