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
