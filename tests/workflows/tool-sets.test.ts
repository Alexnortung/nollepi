import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getToolsForWorkflow } from "../../extensions/workflows/tools/tool-sets.ts";

describe("getToolsForWorkflow", () => {
	const BUILTIN = ["read", "bash", "edit", "write", "grep", "find", "ls"];

	it("returns builtin tools for base", () => {
		const tools = getToolsForWorkflow("base", "idle");
		assert.deepEqual(tools, [...BUILTIN, "workflow_switch", "workflow_state"]);
	});

	it("returns builtin + workflow tools for superpowers", () => {
		const tools = getToolsForWorkflow("superpowers", "idle");
		assert.ok(tools.includes("workflow_switch"));
		assert.ok(tools.includes("workflow_state"));
		for (const t of BUILTIN) assert.ok(tools.includes(t));
	});

	it("returns alignment tools for alignment", () => {
		const tools = getToolsForWorkflow("alignment", "intake");
		assert.ok(tools.includes("workflow_state"));
		assert.ok(tools.includes("workflow_switch"));
		for (const t of BUILTIN) assert.ok(tools.includes(t));
	});

	it("returns autonomous tools for autonomous", () => {
		const tools = getToolsForWorkflow("autonomous", "intake");
		assert.ok(tools.includes("workflow_state"));
		for (const t of BUILTIN) assert.ok(tools.includes(t));
	});
});
