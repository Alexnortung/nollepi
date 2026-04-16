import { AlignmentState } from "../state/alignment-state.ts";

export function applyAlignmentAction(state: AlignmentState, input: any): AlignmentState {
	switch (input.action) {
		case "add_part":
			state.addPart(input.category, { summary: input.summary, details: input.details ?? "" });
			return state;
		case "update_part":
			state.updatePart(input.category, input.partId, { summary: input.summary, details: input.details });
			return state;
		case "confirm":
			state.confirmPart(input.category, input.partId);
			return state;
		case "skip":
			state.skipPart(input.category, input.partId);
			return state;
		case "reopen":
			state.reopenPart(input.category, input.partId);
			return state;
		case "set_relevance":
			state.setCategoryRelevance(input.category, input.relevance);
			return state;
		default:
			throw new Error(`Unknown alignment action: ${input.action}`);
	}
}
