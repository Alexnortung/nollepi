export function parseWorkflowMd(markdown: string): {
	workflowType: string;
	workflowState: string;
	runId: string;
	tasks: Array<{
		id: string;
		status: string;
		summary: string;
		commitHashes: string[];
	}>;
} {
	const workflowType = markdown.match(/^- Workflow type: (.+)$/m)?.[1] ?? "";
	const workflowState = markdown.match(/^- Workflow state: (.+)$/m)?.[1] ?? "";
	const runId = markdown.match(/^- Run id: (.+)$/m)?.[1] ?? "";

	const taskMatches = Array.from(
		markdown.matchAll(/^- \[(.+?)\] (\S+) — (.+)$/gm),
	);
	const tasks = taskMatches.map((match, index) => {
		const blockStart = match.index ?? 0;
		const nextTaskIndex =
			index + 1 < taskMatches.length ? taskMatches[index + 1].index : undefined;
		const block = markdown.slice(blockStart, nextTaskIndex);
		const commitLine = block.match(/^\s*- Commits: (.+)$/m)?.[1] ?? "";
		return {
			status: match[1],
			id: match[2],
			summary: match[3],
			commitHashes: commitLine ? commitLine.split(/,\s*/) : [],
		};
	});

	return { workflowType, workflowState, runId, tasks };
}

export function parseTaskMd(markdown: string): {
	id: string;
	status: string;
	alignmentNeeded: boolean;
	commitHashes: string[];
	description: string;
	steps: Array<{ summary: string; status: string; artifactPath?: string }>;
} {
	const id = markdown.match(/^- Task id: (.+)$/m)?.[1] ?? "";
	const status = markdown.match(/^- Status: (.+)$/m)?.[1] ?? "";
	const alignmentNeeded =
		markdown.match(/^- Alignment needed: (.+)$/m)?.[1] === "true";
	const commitHashes = (markdown.match(/^- Commits: (.+)$/m)?.[1] ?? "")
		.split(/,\s*/)
		.filter(Boolean)
		.filter((value) => value !== "None");
	const description =
		markdown.match(/^## Description\n([\s\S]*?)\n## Steps$/m)?.[1]?.trim() ??
		"";

	const stepsHeader = markdown.match(/^## Steps\n/m);
	const stepsStart = stepsHeader?.index;
	let stepsSection = "";
	if (stepsStart !== undefined) {
		const afterHeader = markdown.slice(stepsStart + stepsHeader![0].length);
		const nextHeadingIndex = afterHeader.search(/^## /m);
		stepsSection =
			nextHeadingIndex === -1
				? afterHeader
				: afterHeader.slice(0, nextHeadingIndex);
	}
	const steps = Array.from(
		stepsSection.matchAll(/^\d+\. \[(.+?)\] (.+?)(?: \((.+\.md)\))?$/gm),
	).map((match) => ({
		status: match[1],
		summary: match[2],
		artifactPath: match[3],
	}));

	return { id, status, alignmentNeeded, commitHashes, description, steps };
}
