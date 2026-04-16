import { AlignmentState, type CategoryRelevance } from "../state/alignment-state.ts";

export type AlignmentAction =
	| { action: "add_part"; category: string; summary: string; details?: string }
	| { action: "update_part"; category: string; partId: string; summary?: string; details?: string }
	| { action: "confirm"; category: string; partId: string }
	| { action: "skip"; category: string; partId: string }
	| { action: "reopen"; category: string; partId: string }
	| { action: "set_relevance"; category: string; relevance: CategoryRelevance };

export function applyAlignmentAction(state: AlignmentState, input: AlignmentAction): AlignmentState {
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
	}
}
