import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Box, Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import type { AlignmentState } from "../state/alignment-state.ts";
import type { SubagentState } from "../state/subagent-state.ts";
import type { TaskState } from "../state/task-state.ts";
import type { WorkflowRuntime } from "../state/workflow-state.ts";
import { renderDispatchCallText, renderDispatchResultText } from "../sidebar/subagent-widget.ts";
import { spawnSubagentProcess } from "../subagents/spawner.ts";
import { prepareSubagentDispatch, shouldAutoTriggerSubagentResult } from "./dispatch-subagent.ts";

export const dispatchSubagentSchema = Type.Object({
	role: Type.String({ description: "investigator, builder, or reviewer" }),
	goal: Type.String({ description: "Why this subagent is being dispatched" }),
	successTarget: Type.String({ description: "What a successful subagent response should provide" }),
	doneCriteria: Type.Optional(Type.Array(Type.String())),
});

export function registerDispatchSubagentTool(
	pi: ExtensionAPI,
	deps: {
		getRuntime: () => WorkflowRuntime;
		getTaskState: () => TaskState;
		getAlignmentState: () => AlignmentState;
		getSubagentState: () => SubagentState;
		persistState: () => void;
		requestUiRefresh: () => void;
		isIdle: () => boolean;
	},
): void {
	pi.registerTool({
		name: "dispatch_subagent",
		label: "Dispatch Subagent",
		description: "Dispatch an investigator, builder, or reviewer background subagent.",
		promptSnippet: "Dispatch investigator/builder/reviewer subagents when the workflow needs focused support.",
		promptGuidelines: [
			"Use investigator during alignment or execution when repo facts are missing.",
			"Use builder only after the task is aligned strongly enough to implement.",
			"Use reviewer only after implementation exists.",
		],
		parameters: dispatchSubagentSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (params.role !== "investigator" && params.role !== "builder" && params.role !== "reviewer") {
				throw new Error(`Unknown subagent role: ${params.role}`);
			}

			const prepared = prepareSubagentDispatch(
				{
					runtime: deps.getRuntime(),
					taskState: deps.getTaskState(),
					alignmentState: deps.getAlignmentState(),
					subagentState: deps.getSubagentState(),
				},
				params.role === "builder"
					? { role: "builder", goal: params.goal, successTarget: params.successTarget, doneCriteria: params.doneCriteria ?? [] }
					: params.role === "reviewer"
						? { role: "reviewer", goal: params.goal, successTarget: params.successTarget }
						: { role: "investigator", goal: params.goal, successTarget: params.successTarget },
			);

			deps.persistState();
			deps.requestUiRefresh();

			spawnSubagentProcess(pi, ctx.cwd, prepared.run, prepared.packet, {
				onText: (delta) => {
					deps.getSubagentState().appendText(prepared.run.id, delta);
					deps.persistState();
					deps.requestUiRefresh();
				},
				onToolCall: () => {
					deps.getSubagentState().recordToolCall(prepared.run.id);
					deps.persistState();
					deps.requestUiRefresh();
				},
				onFinish: (result) => {
					deps.getSubagentState().finishRun(prepared.run.id, result, "done");
					deps.persistState();
					deps.requestUiRefresh();
					pi.sendMessage({
						customType: "workflow-subagent-result",
						content: JSON.stringify({ runId: prepared.run.id, role: prepared.run.role, result }, null, 2),
						details: { runId: prepared.run.id, role: prepared.run.role, result },
						display: false,
					}, {
						deliverAs: "followUp",
						triggerTurn: shouldAutoTriggerSubagentResult(deps.getRuntime().activeWorkflow, deps.isIdle()),
					});
					pi.sendMessage({
						customType: "workflow-subagent-summary",
						content: `${prepared.run.role} #${prepared.run.id} finished.`,
						details: { runId: prepared.run.id, role: prepared.run.role },
						display: true,
					}, { deliverAs: "followUp", triggerTurn: false });
				},
				onError: (message) => {
					deps.getSubagentState().failRun(prepared.run.id, message);
					deps.persistState();
					deps.requestUiRefresh();
					pi.sendMessage({
						customType: "workflow-subagent-summary",
						content: `${prepared.run.role} #${prepared.run.id} failed: ${message}`,
						details: { runId: prepared.run.id, role: prepared.run.role, error: message },
						display: true,
					}, { deliverAs: "followUp", triggerTurn: false });
				},
			});

			return {
				content: [{ type: "text", text: `Dispatched ${prepared.run.role} #${prepared.run.id} in background.` }],
				details: { run: prepared.run, packet: prepared.packet },
			};
		},
		renderCall(args, theme, _context) {
			const lines = renderDispatchCallText(args.role, args.goal);
			const box = new Box(1, 0, (t) => theme.bg("customMessageBg", t));
			box.addChild(new Text(`${theme.bold(lines[0])}\n${theme.fg("dim", lines[1])}`));
			return box;
		},
		renderResult(result, _options, theme, _context) {
			const details = result.details as { run: { id: number; role: string }; packet: unknown } | undefined;
			if (!details?.run) {
				return new Text(theme.fg("muted", "Dispatched subagent."));
			}
			const text = renderDispatchResultText(details.run.role, details.run.id);
			return new Text(theme.fg("success", text));
		},
	});
}
