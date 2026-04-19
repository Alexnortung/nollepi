import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	extractLastOutputLine,
	getVisibleSubagentRuns,
	isTaskOrchestratorVisible,
	renderDispatchCallText,
	renderDispatchResultText,
	renderSubagentCardLines,
	renderSubagentResultText,
	renderSubagentSummaryText,
	renderTaskOrchestratorCardLines,
	type SubagentWidgetRun,
	type SubagentWidgetTaskOrchestrator,
	type WidgetTheme,
} from "../../extensions/workflows/sidebar/subagent-widget.ts";

function makeTheme(): WidgetTheme {
	return {
		fg: (_color: string, text: string) => text,
		bold: (text: string) => text,
	};
}

function makeRun(overrides: Partial<SubagentWidgetRun> = {}): SubagentWidgetRun {
	return {
		id: 1,
		role: "investigator",
		status: "running",
		goal: "Inspect the repo structure",
		taskPreview: "Analyze codebase",
		elapsedSeconds: 12,
		toolCalls: 5,
		lastOutputLine: "Reading package.json...",
		...overrides,
	};
}

function makeTaskOrchestrator(overrides: Partial<SubagentWidgetTaskOrchestrator> = {}): SubagentWidgetTaskOrchestrator {
	return {
		status: "running",
		taskPreview: "Wire specialist dispatch",
		elapsedSeconds: 30,
		turnCount: 3,
		lastOutputLine: "Reviewing changes...",
		...overrides,
	};
}

describe("subagent widget renderer", () => {
	it("extractLastOutputLine gets the last non-empty line", () => {
		assert.equal(extractLastOutputLine("foo\nbar\nbaz"), "baz");
		assert.equal(extractLastOutputLine("foo\nbar\n\n"), "bar");
		assert.equal(extractLastOutputLine(""), "");
		assert.equal(extractLastOutputLine("single"), "single");
	});

	it("renders a subagent card with status, role, elapsed, tools, and output preview", () => {
		const theme = makeTheme();
		const lines = renderSubagentCardLines(makeRun(), theme);
		const text = lines.join("\n");

		assert.ok(text.includes("Investigator"), "shows role label");
		assert.ok(text.includes("#1"), "shows run id");
		assert.ok(text.includes("running"), "shows status");
		assert.ok(text.includes("12s"), "shows elapsed time");
		assert.ok(text.includes("5 tools"), "shows tool count");
		assert.ok(text.includes("Inspect the repo"), "shows goal");
		assert.ok(text.includes("Reading package.json"), "shows last output line");
	});

	it("renders a subagent card without output preview when empty", () => {
		const theme = makeTheme();
		const lines = renderSubagentCardLines(makeRun({ lastOutputLine: "" }), theme);
		const text = lines.join("\n");
		assert.ok(!text.includes("▸"), "no output preview arrow");
	});

	it("renders task orchestrator card with status, turns, and output preview", () => {
		const theme = makeTheme();
		const lines = renderTaskOrchestratorCardLines(makeTaskOrchestrator(), theme);
		const text = lines.join("\n");

		assert.ok(text.includes("Task Orchestrator"), "shows task orchestrator label");
		assert.ok(text.includes("running"), "shows status");
		assert.ok(text.includes("30s"), "shows elapsed time");
		assert.ok(text.includes("3 turns"), "shows turn count");
		assert.ok(text.includes("Reviewing changes"), "shows last output line");
	});

	it("getVisibleSubagentRuns returns active runs plus last 3 done", () => {
		const runs = [
			makeRun({ id: 1, status: "done" }),
			makeRun({ id: 2, status: "done" }),
			makeRun({ id: 3, status: "done" }),
			makeRun({ id: 4, status: "done" }),
			makeRun({ id: 5, status: "done" }),
			makeRun({ id: 6, status: "running" }),
		];
		const visible = getVisibleSubagentRuns(runs);
		const ids = visible.map((r) => r.id);

		assert.ok(ids.includes(6), "active run visible");
		assert.ok(ids.includes(3), "recent done run visible");
		assert.ok(ids.includes(4), "recent done run visible");
		assert.ok(ids.includes(5), "recent done run visible");
		assert.ok(!ids.includes(1), "oldest done run hidden");
		assert.ok(!ids.includes(2), "second oldest done run hidden");
	});

	it("getVisibleSubagentRuns returns empty for no runs", () => {
		assert.deepEqual(getVisibleSubagentRuns([]), []);
	});

	it("isTaskOrchestratorVisible returns false for closed or undefined", () => {
		assert.equal(isTaskOrchestratorVisible(undefined), false);
		assert.equal(isTaskOrchestratorVisible(makeTaskOrchestrator({ status: "closed" })), false);
		assert.equal(isTaskOrchestratorVisible(makeTaskOrchestrator({ status: "running" })), true);
		assert.equal(isTaskOrchestratorVisible(makeTaskOrchestrator({ status: "waiting" })), true);
	});

	it("pluralizes tool count correctly", () => {
		const theme = makeTheme();
		const text1 = renderSubagentCardLines(makeRun({ toolCalls: 1 }), theme).join("\n");
		assert.ok(text1.includes("1 tool"), "singular");
		assert.ok(!text1.includes("1 tools"), "not plural for 1");

		const text3 = renderSubagentCardLines(makeRun({ toolCalls: 3 }), theme).join("\n");
		assert.ok(text3.includes("3 tools"), "plural for 3");
	});

	it("pluralizes turn count correctly for task orchestrator", () => {
		const theme = makeTheme();
		const text1 = renderTaskOrchestratorCardLines(makeTaskOrchestrator({ turnCount: 1 }), theme).join("\n");
		assert.ok(text1.includes("1 turn"), "singular");
		assert.ok(!text1.includes("1 turns"), "not plural for 1");
	});

	it("truncates long goals", () => {
		const theme = makeTheme();
		const longGoal = "A".repeat(100);
		const lines = renderSubagentCardLines(makeRun({ goal: longGoal }), theme);
		const goalLine = lines.find((l) => l.includes("A"));
		assert.ok(goalLine !== undefined);
		assert.ok(goalLine!.includes("…"), "truncated with ellipsis");
	});
});

describe("dispatch subagent rendering functions", () => {
	it("renderDispatchCallText returns role label and goal preview", () => {
		const lines = renderDispatchCallText("investigator", "Check the repo");
		assert.equal(lines.length, 2);
		assert.ok(lines[0].includes("Investigator"));
		assert.ok(lines[0].includes("dispatching"));
		assert.ok(lines[1].includes("Check the repo"));
	});

	it("renderDispatchCallText truncates long goals", () => {
		const lines = renderDispatchCallText("builder", "A".repeat(100));
		assert.ok(lines[1].endsWith("…"));
		assert.ok(lines[1].length <= 80);
	});

	it("renderDispatchResultText includes role and run id", () => {
		const text = renderDispatchResultText("reviewer", 5);
		assert.ok(text.includes("Reviewer"));
		assert.ok(text.includes("#5"));
		assert.ok(text.includes("dispatched"));
	});
});

describe("subagent summary and result text functions", () => {
	it("renderSubagentSummaryText for successful completion", () => {
		const lines = renderSubagentSummaryText("investigator", 3);
		const text = lines.join("\n");
		assert.ok(text.includes("✓"));
		assert.ok(text.includes("Investigator"));
		assert.ok(text.includes("#3"));
		assert.ok(text.includes("finished"));
	});

	it("renderSubagentSummaryText for failure", () => {
		const lines = renderSubagentSummaryText("builder", 4, "timeout");
		const text = lines.join("\n");
		assert.ok(text.includes("✗"));
		assert.ok(text.includes("Builder"));
		assert.ok(text.includes("failed"));
		assert.ok(text.includes("timeout"));
	});

	it("renderSubagentResultText collapsed shows verdict and next action preview", () => {
		const lines = renderSubagentResultText(7, {
			role: "reviewer",
			verdict: "pass",
			findingsCount: 0,
			issuesCount: 2,
			verificationGapsCount: 1,
			suggestedNextAction: "Ship it",
		}, false);
		const text = lines.join("\n");
		assert.ok(text.includes("Reviewer"));
		assert.ok(text.includes("#7"));
		assert.ok(text.includes("PASS"));
		assert.ok(text.includes("Ship it"));
		assert.ok(!text.includes("issue(s)"), "counts hidden when collapsed");
	});

	it("renderSubagentResultText expanded shows counts", () => {
		const lines = renderSubagentResultText(7, {
			role: "reviewer",
			verdict: "fail",
			findingsCount: 3,
			issuesCount: 2,
			verificationGapsCount: 1,
			suggestedNextAction: "Fix the issues",
		}, true);
		const text = lines.join("\n");
		assert.ok(text.includes("FAIL"));
		assert.ok(text.includes("3 finding(s)"));
		assert.ok(text.includes("2 issue(s)"));
		assert.ok(text.includes("1 verification gap(s)"));
		assert.ok(text.includes("Next: Fix the issues"));
	});

	it("renderSubagentResultText truncates long next action when collapsed", () => {
		const lines = renderSubagentResultText(1, {
			role: "investigator",
			findingsCount: 0,
			issuesCount: 0,
			verificationGapsCount: 0,
			suggestedNextAction: "A".repeat(100),
		}, false);
		const nextLine = lines.find((l) => l.includes("A"));
		assert.ok(nextLine !== undefined);
		assert.ok(nextLine!.includes("…"), "truncated");
	});
});
