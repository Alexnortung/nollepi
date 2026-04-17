import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AlignmentState } from "../../extensions/workflows/state/alignment-state.ts";
import { SubagentState } from "../../extensions/workflows/state/subagent-state.ts";
import { TaskState } from "../../extensions/workflows/state/task-state.ts";
import { createWorkflowRuntime } from "../../extensions/workflows/state/workflow-state.ts";
import { buildDispatchPacket } from "../../extensions/workflows/subagents/packet-builder.ts";

describe("buildDispatchPacket", () => {
	function makeBaseFixture() {
		const runtime = createWorkflowRuntime();
		runtime.switchTo("alignment");
		runtime.transition("intake");
		runtime.transition("high-level-alignment");
		runtime.transition("task-proposal");
		runtime.transition("task-list-alignment");
		runtime.transition("task-list-approval");
		runtime.transition("task-execution");
		runtime.runId = "2026-04-16-01-test";

		const taskState = new TaskState();
		taskState.addTask({
			summary: "Implement builder dispatch",
			description: "Add background builder subagent",
			alignmentNeeded: true,
		});
		taskState.updateTask("01-implement-builder-dispatch", { status: "in-progress" });
		taskState.selectCurrentTask("01-implement-builder-dispatch");
		taskState.addStep({
			taskId: "01-implement-builder-dispatch",
			summary: "Write tests",
			description: "Add failing tests first",
			hasArtifact: false,
		});

		const alignment = new AlignmentState();
		alignment.addPart("objective", { summary: "Add builder subagent", details: "Delegate implementation work" });
		alignment.addPart("constraints", { summary: "Keep orchestrator owner", details: "Subagent never talks to human" });
		alignment.addPart("risks", { summary: "Same-worktree edit collisions", details: "Only one builder at a time" });
		alignment.addPart("open-questions", { summary: "How to parse final result", details: "Need structured output" });
		alignment.confirmPart("objective", "part-1");
		alignment.confirmPart("constraints", "part-2");

		const subagents = new SubagentState();
		const investigatorRun = subagents.startRun({
			role: "investigator",
			taskId: "01-implement-builder-dispatch",
			goal: "Inspect repo usage",
			taskPreview: "Find prior subagent patterns",
		});
		subagents.finishRun(investigatorRun.id, {
			role: "investigator",
			findings: ["Use a widget for running state"],
			relevantFiles: ["extensions/subagent-widget.ts"],
			risks: [],
			openQuestions: [],
			suggestedNextAction: "Pass findings to builder",
		}, "done");

		return { runtime, taskState, alignment, subagents };
	}

	it("builds an investigator packet with unresolved repo-facing questions", () => {
		const { runtime, taskState, alignment, subagents } = makeBaseFixture();
		const packet = buildDispatchPacket(
			{ runtime, taskState, alignmentState: alignment, subagentState: subagents },
			{ role: "investigator", goal: "Find files and risks", successTarget: "Return file list and risks" },
		);

		assert.equal(packet.role, "investigator");
		assert.ok(packet.unresolvedQuestions.includes("How to parse final result"));
		assert.ok(packet.repoFacingRisks.includes("Same-worktree edit collisions"));
		assert.ok(packet.agreedContext.constraints.includes("Keep orchestrator owner"));
	});

	it("builds a builder packet with aligned context and prior findings, but not unresolved questions", () => {
		const { runtime, taskState, alignment, subagents } = makeBaseFixture();
		const packet = buildDispatchPacket(
			{ runtime, taskState, alignmentState: alignment, subagentState: subagents },
			{
				role: "builder",
				goal: "Implement the builder background runner",
				successTarget: "Create working builder dispatch",
				doneCriteria: ["tests pass", "builder runs in background"],
			},
		);

		assert.equal(packet.role, "builder");
		assert.ok(packet.alignedContext.objective.includes("Add builder subagent"));
		assert.ok(packet.alignedContext.constraints.includes("Keep orchestrator owner"));
		assert.ok(packet.priorFindings.includes("Use a widget for running state"));
		assert.equal("unresolvedQuestions" in packet, false);
		assert.deepEqual(packet.doneCriteria, ["tests pass", "builder runs in background"]);
	});

	it("builds a reviewer packet with latest builder result context", () => {
		const { runtime, taskState, alignment, subagents } = makeBaseFixture();
		const builderRun = subagents.startRun({
			role: "builder",
			taskId: "01-implement-builder-dispatch",
			goal: "Implement task",
			taskPreview: "Build feature",
		});
		subagents.finishRun(builderRun.id, {
			role: "builder",
			summary: "Implemented background builder dispatch",
			changedFiles: ["extensions/workflows/subagents/spawner.ts"],
			commits: ["abc1234"],
			verification: ["pnpm test"],
			blockers: [],
		}, "done");

		const packet = buildDispatchPacket(
			{ runtime, taskState, alignmentState: alignment, subagentState: subagents },
			{ role: "reviewer", goal: "Review builder work", successTarget: "Return pass or needs-changes" },
		);

		assert.equal(packet.role, "reviewer");
		assert.equal(packet.builderSummary, "Implemented background builder dispatch");
		assert.deepEqual(packet.changedFiles, ["extensions/workflows/subagents/spawner.ts"]);
		assert.deepEqual(packet.commits, ["abc1234"]);
	});

	it("includes prior task outcome summaries in priorFindings", () => {
		const { runtime, taskState, alignment, subagents } = makeBaseFixture();

		taskState.addTask({ summary: "Prior task", description: "Something done before", alignmentNeeded: false });
		taskState.recordTaskOutcome("02-prior-task", {
			changedFiles: ["extensions/workflows/state/task-state.ts"],
			relevantSymbols: ["TaskState.recordTaskCommit"],
			notes: ["task-state now tracks commit hashes per task"],
		});

		const packet = buildDispatchPacket(
			{ runtime, taskState, alignmentState: alignment, subagentState: subagents },
			{ role: "investigator", goal: "Check state", successTarget: "Return findings" },
		);

		const findings = packet.priorFindings.join("\n");
		assert.ok(findings.includes("02-prior-task"), "should include prior task id");
		assert.ok(findings.includes("extensions/workflows/state/task-state.ts"), "should include changed file");
		assert.ok(findings.includes("TaskState.recordTaskCommit"), "should include relevant symbol");
		assert.ok(findings.includes("task-state now tracks commit hashes per task"), "should include note");
	});

	it("packet with no completed outcomes has investigator findings but no task summary lines", () => {
		const { runtime, taskState, alignment, subagents } = makeBaseFixture();

		const packet = buildDispatchPacket(
			{ runtime, taskState, alignmentState: alignment, subagentState: subagents },
			{ role: "investigator", goal: "Check state", successTarget: "Return findings" },
		);

		assert.ok(packet.priorFindings.includes("Use a widget for running state"), "investigator finding still present");
		assert.ok(!packet.priorFindings.some((f) => f.startsWith("Task ")), "no task outcome lines without recorded outcomes");
	});
});
