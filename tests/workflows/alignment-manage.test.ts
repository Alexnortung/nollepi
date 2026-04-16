import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyAlignmentAction } from "../../extensions/workflows/tools/alignment-manage.ts";
import { AlignmentState } from "../../extensions/workflows/state/alignment-state.ts";

describe("alignment_manage", () => {
	it("adds part", () => {
		const state = new AlignmentState();
		applyAlignmentAction(state, {
			action: "add_part",
			category: "risks",
			summary: "Data migration risk",
			details: "Old schema incompatible",
		});
		assert.equal(state.categories.find((c) => c.name === "risks")!.parts.length, 1);
	});

	it("confirms part", () => {
		const state = new AlignmentState();
		applyAlignmentAction(state, {
			action: "add_part",
			category: "objective",
			summary: "Build variants",
			details: "",
		});
		const partId = state.categories.find((c) => c.name === "objective")!.parts[0].id;
		applyAlignmentAction(state, {
			action: "confirm",
			category: "objective",
			partId,
		});
		assert.equal(state.categories.find((c) => c.name === "objective")!.parts[0].state, "aligned");
	});

	it("skips part", () => {
		const state = new AlignmentState();
		applyAlignmentAction(state, {
			action: "add_part",
			category: "scope",
			summary: "Scope item",
			details: "",
		});
		const partId = state.categories.find((c) => c.name === "scope")!.parts[0].id;
		applyAlignmentAction(state, {
			action: "skip",
			category: "scope",
			partId,
		});
		assert.equal(state.categories.find((c) => c.name === "scope")!.parts[0].state, "skipped");
	});

	it("sets category not relevant", () => {
		const state = new AlignmentState();
		applyAlignmentAction(state, {
			action: "set_relevance",
			category: "domain-language",
			relevance: "not-relevant",
		});
		assert.equal(state.categories.find((c) => c.name === "domain-language")!.relevance, "not-relevant");
	});

	it("reopens part", () => {
		const state = new AlignmentState();
		applyAlignmentAction(state, {
			action: "add_part",
			category: "risks",
			summary: "Risk",
			details: "",
		});
		const partId = state.categories.find((c) => c.name === "risks")!.parts[0].id;
		applyAlignmentAction(state, { action: "confirm", category: "risks", partId });
		applyAlignmentAction(state, { action: "reopen", category: "risks", partId });
		assert.equal(state.categories.find((c) => c.name === "risks")!.parts[0].state, "under-discussion");
	});
});
