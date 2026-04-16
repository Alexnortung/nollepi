import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AlignmentState } from "../../extensions/workflows/state/alignment-state.ts";

describe("AlignmentState", () => {
	it("initializes with default categories", () => {
		const state = new AlignmentState();
		assert.ok(state.categories.length > 0);
		assert.ok(state.categories.find((c) => c.name === "objective"));
		assert.ok(state.categories.find((c) => c.name === "risks"));
	});

	it("adds part to category", () => {
		const state = new AlignmentState();
		state.addPart("risks", {
			summary: "Data migration risk",
			details: "Old schema incompatible",
		});
		const risks = state.categories.find((c) => c.name === "risks")!;
		assert.equal(risks.parts.length, 1);
		assert.equal(risks.parts[0].state, "unaligned");
	});

	it("confirms part moves to aligned", () => {
		const state = new AlignmentState();
		state.addPart("objective", {
			summary: "Build button variants",
			details: "Support primary/secondary/danger",
		});
		state.confirmPart("objective", state.categories.find((c) => c.name === "objective")!.parts[0].id);
		const part = state.categories.find((c) => c.name === "objective")!.parts[0];
		assert.equal(part.state, "aligned");
	});

	it("marks part as skipped", () => {
		const state = new AlignmentState();
		state.addPart("scope", { summary: "Test scope", details: "" });
		const partId = state.categories.find((c) => c.name === "scope")!.parts[0].id;
		state.skipPart("scope", partId);
		assert.equal(state.categories.find((c) => c.name === "scope")!.parts[0].state, "skipped");
	});

	it("marks category not relevant", () => {
		const state = new AlignmentState();
		state.setCategoryRelevance("domain-language", "not-relevant");
		const cat = state.categories.find((c) => c.name === "domain-language")!;
		assert.equal(cat.relevance, "not-relevant");
	});

	it("reopens aligned part to under-discussion", () => {
		const state = new AlignmentState();
		state.addPart("risks", { summary: "Risk A", details: "Details" });
		const partId = state.categories.find((c) => c.name === "risks")!.parts[0].id;
		state.confirmPart("risks", partId);
		state.reopenPart("risks", partId);
		assert.equal(state.categories.find((c) => c.name === "risks")!.parts[0].state, "under-discussion");
	});

	it("getSummary returns aligned/pending/total counts", () => {
		const state = new AlignmentState();
		state.addPart("objective", { summary: "Goal", details: "" });
		state.addPart("risks", { summary: "Risk", details: "" });
		state.confirmPart("objective", state.categories.find((c) => c.name === "objective")!.parts[0].id);

		const summary = state.getSummary();
		assert.equal(summary.aligned, 1);
		assert.equal(summary.pending, 1);
		assert.equal(summary.total, 2);
	});

	it("serializes and restores", () => {
		const state = new AlignmentState();
		state.addPart("objective", { summary: "Goal", details: "Details" });
		state.confirmPart("objective", state.categories.find((c) => c.name === "objective")!.parts[0].id);

		const snapshot = state.serialize();
		const restored = AlignmentState.restore(snapshot);
		assert.equal(restored.categories.find((c) => c.name === "objective")!.parts[0].state, "aligned");
	});
});
