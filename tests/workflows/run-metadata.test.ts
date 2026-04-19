import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AlignmentState } from "../../extensions/workflows/state/alignment-state.ts";
import { TaskState } from "../../extensions/workflows/state/task-state.ts";
import {
	getRunTitleCandidate,
	shouldCreateRunArtifacts,
	summarizeRunTitle,
} from "../../extensions/workflows/state/artifacts/run-metadata.ts";

describe("run metadata", () => {
	it("does not create run artifacts during idle or intake", () => {
		assert.equal(shouldCreateRunArtifacts("alignment", "idle"), false);
		assert.equal(shouldCreateRunArtifacts("alignment", "intake"), false);
		assert.equal(shouldCreateRunArtifacts("autonomous", "intake"), false);
		assert.equal(shouldCreateRunArtifacts("base", "idle"), false);
	});

	it("creates run artifacts after intake for artifact-backed workflows", () => {
		assert.equal(shouldCreateRunArtifacts("alignment", "high-level-alignment"), true);
		assert.equal(shouldCreateRunArtifacts("alignment", "task-execution"), true);
		assert.equal(shouldCreateRunArtifacts("autonomous", "lightweight-alignment"), true);
	});

	it("keeps up to five words when already short", () => {
		assert.equal(summarizeRunTitle("Readable run id after intake"), "Readable run id after intake");
	});

	it("prefers three to four words when the source is longer", () => {
		assert.equal(
			summarizeRunTitle("Delay workflow artifact creation until task scope is clearer"),
			"Delay workflow artifact creation",
		);
	});

	it("derives the run title from scope/objective before falling back to tasks", () => {
		const alignment = new AlignmentState();
		alignment.addPart("scope", {
			summary: "Delay workflow artifact creation until scope is clearer",
			details: "Use a post-intake descriptive run id",
		});

		const tasks = new TaskState();
		tasks.addTask({
			summary: "Update run id allocation timing",
			description: "Move creation later",
			alignmentNeeded: true,
		});

		assert.equal(getRunTitleCandidate(tasks, alignment), "Delay workflow artifact creation");
	});

	it("returns undefined until some descriptive data exists", () => {
		assert.equal(getRunTitleCandidate(new TaskState(), new AlignmentState()), undefined);
	});
});
