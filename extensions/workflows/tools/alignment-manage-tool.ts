import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { AlignmentState } from "../state/alignment-state.ts";
import { applyAlignmentAction } from "./alignment-manage.ts";

export const alignmentManageSchema = Type.Object({
	action: Type.String({
		description: "One of: add_part, update_part, confirm, skip, reopen, set_relevance",
	}),
	category: Type.String({ description: "Category name (objective, scope, constraints, risks, domain-language, approach, open-questions)" }),
	partId: Type.Optional(Type.String()),
	summary: Type.Optional(Type.String()),
	details: Type.Optional(Type.String()),
	relevance: Type.Optional(Type.String({ description: "relevant or not-relevant" })),
});

export function registerAlignmentManageTool(
	pi: ExtensionAPI,
	getAlignmentState: () => AlignmentState,
	onChange: () => void,
): void {
	pi.registerTool({
		name: "alignment_manage",
		label: "Alignment Manage",
		description:
			"Manage mental alignment: add parts, confirm/skip/reopen parts, set category relevance. " +
			"Categories: objective, scope, constraints, risks, domain-language, approach, open-questions.",
		promptSnippet: "Manage mental alignment categories and parts",
		promptGuidelines: [
			"Use alignment_manage to track what has been aligned with the human.",
			"Each part must be explicitly confirmed by the human before it counts as aligned.",
			"Do not repeat already-aligned parts.",
		],
		parameters: alignmentManageSchema,
		async execute(_toolCallId, params) {
			const state = getAlignmentState();
			applyAlignmentAction(state, params);
			onChange();
			const summary = state.getSummary();
			return {
				content: [
					{
						type: "text",
						text:
							`Applied alignment action: ${params.action}. ` +
							`Aligned: ${summary.aligned} | Pending: ${summary.pending} | Skipped: ${summary.skipped}`,
					},
				],
				details: {
					action: params.action,
					summary,
					categories: state.categories,
				},
			};
		},
	});
}
