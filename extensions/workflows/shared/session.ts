import type { WorkflowUiState } from "./types";

export function restoreUiStateFromBranch(entries: Array<{ type: string; customType?: string; data?: unknown }>) {
	let latest: WorkflowUiState | undefined;

	for (const entry of entries) {
		if (entry.type === "custom" && entry.customType === "workflow-ui-state") {
			latest = entry.data as WorkflowUiState;
		}
	}

	return latest ?? {};
}
