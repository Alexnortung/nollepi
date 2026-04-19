import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	buildRunId,
	getRunDir,
	getWorkflowMdPath,
	getTaskDir,
	getTaskMdPath,
	getStepMdPath,
} from "../../extensions/workflows/state/artifacts/paths.ts";

describe("artifact paths", () => {
	it("builds stable run id", () => {
		const runId = buildRunId("alignment", "button variants", new Date("2026-04-16T12:00:00Z"));
		assert.equal(runId, "2026-04-16-01-alignment-button-variants");
	});

	it("builds workflow.md path", () => {
		assert.equal(
			getWorkflowMdPath("2026-04-16-01-alignment-button-variants"),
			"docs/.workflows/runs/2026-04-16-01-alignment-button-variants/workflow.md",
		);
	});

	it("builds task dir and task.md path", () => {
		assert.equal(
			getTaskDir("2026-04-16-01-alignment-button-variants", "01-update-domain-types"),
			"docs/.workflows/runs/2026-04-16-01-alignment-button-variants/tasks/01-update-domain-types",
		);
		assert.equal(
			getTaskMdPath("2026-04-16-01-alignment-button-variants", "01-update-domain-types"),
			"docs/.workflows/runs/2026-04-16-01-alignment-button-variants/tasks/01-update-domain-types/task.md",
		);
	});

	it("builds step artifact path", () => {
		assert.equal(
			getStepMdPath(
				"2026-04-16-01-alignment-button-variants",
				"01-update-domain-types",
				"step-2-variant-prop-contract",
			),
			"docs/.workflows/runs/2026-04-16-01-alignment-button-variants/tasks/01-update-domain-types/step-2-variant-prop-contract.md",
		);
	});
});
