import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildWorkflowPrompt } from "../../extensions/workflows/prompts/prompt-builder.ts";
import { createWorkflowRuntime } from "../../extensions/workflows/state/workflow-state.ts";

describe("buildWorkflowPrompt", () => {
	it("returns base instructions for base workflow", () => {
		const runtime = createWorkflowRuntime();
		const prompt = buildWorkflowPrompt(runtime);
		assert.ok(prompt.includes("base"));
		assert.ok(!prompt.includes("[ALIGNMENT WORKFLOW]"));
		assert.match(prompt, /do not use superpowers/i);
	});

	it("returns superpowers instructions for superpowers workflow", () => {
		const runtime = createWorkflowRuntime();
		runtime.switchTo("superpowers");
		const prompt = buildWorkflowPrompt(runtime);
		assert.ok(prompt.includes("superpowers"));
	});

	it("returns alignment instructions with state for alignment workflow", () => {
		const runtime = createWorkflowRuntime();
		runtime.switchTo("alignment");
		runtime.transition("intake");
		const prompt = buildWorkflowPrompt(runtime);
		assert.ok(prompt.includes("[ALIGNMENT WORKFLOW]"));
		assert.ok(prompt.includes("intake"));
		assert.match(prompt, /do not use superpowers/i);
		assert.match(prompt, /begin with a brief overview of your current mental model/i);
		assert.match(prompt, /human review → next task \/ finish/i);
		assert.match(prompt, /high-level orchestrator/i);
		assert.match(prompt, /task orchestrator/i);
		assert.doesNotMatch(prompt, /approved → commit/i);
	});

	it("alignment human review guidance includes commit-aware direct exits", () => {
		const runtime = createWorkflowRuntime({
			activeWorkflow: "alignment",
			workflowState: "human-review",
			runId: undefined,
		});
		const prompt = buildWorkflowPrompt(runtime);
		assert.match(prompt, /including a proposed commit message/i);
		assert.match(prompt, /transition directly to next-task or finish/i);
		assert.match(prompt, /existing commit hash/i);
		assert.match(prompt, /duplicate commit/i);
	});

	it("returns autonomous instructions for autonomous workflow", () => {
		const runtime = createWorkflowRuntime();
		runtime.switchTo("autonomous");
		runtime.transition("intake");
		const prompt = buildWorkflowPrompt(runtime);
		assert.ok(prompt.includes("[AUTONOMOUS WORKFLOW]"));
		assert.ok(prompt.includes("intake"));
		assert.match(prompt, /do not use superpowers/i);
	});
});
