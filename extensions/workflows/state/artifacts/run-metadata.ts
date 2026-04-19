import type { AlignmentState } from "../alignment-state.ts";
import type { TaskRuntimeState } from "../task-state.ts";
import type { WorkflowName } from "../workflow-state.ts";

const ARTIFACT_RUN_WORKFLOWS = new Set<WorkflowName>(["alignment", "autonomous"]);
const PRE_RUN_ARTIFACT_STATES = new Set(["idle", "intake"]);
const MAX_RUN_TITLE_WORDS = 5;
const PREFERRED_RUN_TITLE_WORDS = 4;

function normalizeText(input: string | undefined): string {
	return input?.replace(/\s+/g, " ").trim() ?? "";
}

function extractWords(input: string): string[] {
	return normalizeText(input)
		.split(" ")
		.map((word) => word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ""))
		.filter(Boolean);
}

function getAlignmentCandidate(alignmentState: AlignmentState, categoryName: string): string | undefined {
	const category = alignmentState.categories.find((item) => item.name === categoryName);
	if (!category || category.relevance === "not-relevant") return undefined;

	return [...category.parts]
		.reverse()
		.find((part) => part.state !== "skipped" && part.state !== "not-relevant")?.summary;
}

export function shouldCreateRunArtifacts(workflow: WorkflowName, workflowState: string): boolean {
	return ARTIFACT_RUN_WORKFLOWS.has(workflow) && !PRE_RUN_ARTIFACT_STATES.has(workflowState);
}

export function summarizeRunTitle(input: string): string {
	const words = extractWords(input);
	if (words.length <= MAX_RUN_TITLE_WORDS) return words.join(" ");
	return words.slice(0, PREFERRED_RUN_TITLE_WORDS).join(" ");
}

export function getRunTitleCandidate(taskState: TaskRuntimeState, alignmentState: AlignmentState): string | undefined {
	const candidates = [
		taskState.runTitle,
		getAlignmentCandidate(alignmentState, "scope"),
		getAlignmentCandidate(alignmentState, "objective"),
		taskState.tasks[0]?.summary,
	];

	for (const candidate of candidates) {
		const summary = summarizeRunTitle(candidate ?? "");
		if (summary) return summary;
	}

	return undefined;
}
