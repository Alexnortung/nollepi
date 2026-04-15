import { strict as assert } from "node:assert";
import test from "node:test";
import { buildWorkflowRunSlug } from "../../extensions/workflows/shared/slug";

test("buildWorkflowRunSlug creates sortable human-readable workflow folder names", () => {
	assert.equal(
		buildWorkflowRunSlug({ date: "2026-04-15", index: 2, workflow: "alignment", title: "Button Variants" }),
		"2026-04-15-02-alignment-button-variants",
	);
});
