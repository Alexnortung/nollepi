import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderSidebar, type SidebarState } from "../../extensions/workflows/sidebar/renderer.ts";

describe("renderSidebar", () => {
	it("renders minimal line for base:idle", () => {
		const state: SidebarState = {
			workflow: "base",
			workflowState: "idle",
			tasks: [],
		};
		const lines = renderSidebar(state);
		assert.ok(lines.length >= 1);
		assert.ok(lines[0].includes("base"));
		assert.ok(lines[0].includes("idle"));
	});

	it("renders task list with status icons", () => {
		const state: SidebarState = {
			workflow: "alignment",
			workflowState: "task-execution",
			tasks: [
				{
					id: "01-add-types",
					summary: "Update types",
					status: "committed",
					isCurrent: false,
					steps: [],
				},
				{
					id: "02-add-logic",
					summary: "Add logic",
					status: "in-progress",
					isCurrent: true,
					steps: [
						{ id: "step-1", summary: "Write tests", status: "in-progress", isCurrent: true },
						{ id: "step-2", summary: "Implement", status: "pending", isCurrent: false },
					],
				},
				{
					id: "03-cleanup",
					summary: "Cleanup",
					status: "proposed",
					isCurrent: false,
					steps: [],
				},
			],
		};
		const lines = renderSidebar(state);
		const text = lines.join("\n");

		// Should have tasks section
		assert.ok(text.includes("Tasks"));
		// Current task marker
		assert.ok(text.includes("02-add-logic"));
		// Status icons present
		assert.ok(text.includes("✓"), "committed task should show ✓");
		assert.ok(text.includes("▶"), "in-progress should show ▶");
		assert.ok(text.includes("○"), "pending step should show ○");
	});

	it("shows alignment summary for alignment workflow", () => {
		const state: SidebarState = {
			workflow: "alignment",
			workflowState: "high-level-alignment",
			tasks: [],
			alignment: {
				aligned: 3,
				pending: 2,
				skipped: 1,
				total: 6,
				categories: [
					{
						name: "objective",
						relevance: "relevant",
						parts: [
							{ id: "part-1", summary: "Build variants", state: "aligned" },
							{ id: "part-2", summary: "Support themes", state: "aligned" },
						],
					},
					{
						name: "risks",
						relevance: "relevant",
						parts: [
							{ id: "part-3", summary: "Migration risk", state: "unaligned" },
						],
					},
					{
						name: "domain-language",
						relevance: "not-relevant",
						parts: [],
					},
				],
			},
		};
		const lines = renderSidebar(state);
		const text = lines.join("\n");

		assert.ok(text.includes("Alignment"));
		assert.ok(text.includes("3"), "should show aligned count");
		assert.ok(text.includes("objective"));
		assert.ok(text.includes("risks"));
	});

	it("hides alignment section for base workflow", () => {
		const state: SidebarState = {
			workflow: "base",
			workflowState: "idle",
			tasks: [],
			alignment: {
				aligned: 0,
				pending: 0,
				skipped: 0,
				total: 0,
				categories: [],
			},
		};
		const lines = renderSidebar(state);
		const text = lines.join("\n");
		assert.ok(!text.includes("Alignment"), "base should not show alignment");
	});

	it("hides tasks section when no tasks", () => {
		const state: SidebarState = {
			workflow: "alignment",
			workflowState: "intake",
			tasks: [],
		};
		const lines = renderSidebar(state);
		const text = lines.join("\n");
		assert.ok(!text.includes("Tasks"), "no tasks = no tasks section");
	});

	it("shows current task pointer", () => {
		const state: SidebarState = {
			workflow: "alignment",
			workflowState: "task-execution",
			tasks: [
				{ id: "01-foo", summary: "Foo", status: "in-progress", isCurrent: true, steps: [] },
				{ id: "02-bar", summary: "Bar", status: "proposed", isCurrent: false, steps: [] },
			],
		};
		const lines = renderSidebar(state);
		const fooLine = lines.find((l) => l.includes("Foo"));
		assert.ok(fooLine?.includes("←"), "current task should have pointer");
	});

	it("shows step details for current task only", () => {
		const state: SidebarState = {
			workflow: "autonomous",
			workflowState: "task-execution",
			tasks: [
				{
					id: "01-done",
					summary: "Done task",
					status: "committed",
					isCurrent: false,
					steps: [{ id: "step-1", summary: "Hidden step", status: "done", isCurrent: false }],
				},
				{
					id: "02-active",
					summary: "Active task",
					status: "in-progress",
					isCurrent: true,
					steps: [
						{ id: "step-1", summary: "Visible step", status: "done", isCurrent: false },
						{ id: "step-2", summary: "Current step", status: "in-progress", isCurrent: true },
					],
				},
			],
		};
		const lines = renderSidebar(state);
		const text = lines.join("\n");
		assert.ok(!text.includes("Hidden step"), "non-current task steps hidden");
		assert.ok(text.includes("Visible step"), "current task steps shown");
		assert.ok(text.includes("Current step"), "current task steps shown");
	});
});
