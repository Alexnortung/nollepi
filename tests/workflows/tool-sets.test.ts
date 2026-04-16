import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getToolsForWorkflow } from "../../extensions/workflows/tools/tool-sets.ts";

describe("getToolsForWorkflow", () => {
	const BASE_TOOLS = ["read", "bash", "edit", "write"];
	const EXTRA_TOOLS = ["grep", "find", "ls"];
	const WORKFLOW_TOOLS = ["workflow_switch", "workflow_state", "workflow_transition"];

	it("returns base tools for base", () => {
		const tools = getToolsForWorkflow("base", "idle");
		assert.deepEqual(tools, [...BASE_TOOLS, ...WORKFLOW_TOOLS]);
	});

	it("returns base tools for superpowers", () => {
		const tools = getToolsForWorkflow("superpowers", "idle");
		assert.deepEqual(tools, [...BASE_TOOLS, ...WORKFLOW_TOOLS]);
	});

	it("returns base tools plus task and step manage for alignment", () => {
		const tools = getToolsForWorkflow("alignment", "intake");
		assert.deepEqual(tools, [...BASE_TOOLS, ...WORKFLOW_TOOLS, "task_manage", "step_manage"]);
	});

	it("returns base plus task/step manage and extra tools for autonomous", () => {
		const tools = getToolsForWorkflow("autonomous", "intake");
		assert.deepEqual(tools, [...BASE_TOOLS, ...WORKFLOW_TOOLS, "task_manage", "step_manage", ...EXTRA_TOOLS]);
	});
});
