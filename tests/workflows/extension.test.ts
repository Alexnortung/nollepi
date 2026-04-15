import { strict as assert } from "node:assert";
import test from "node:test";
import workflowsExtension from "../../extensions/workflows/index";

test("workflow command restores widget from artifacts and blocks switching from unfinished alignment", async () => {
	const commands = new Map<string, { handler: (args: string, ctx: any) => Promise<void> }>();
	const widgets: Array<{ key: string; lines: string[] }> = [];
	let startupHandler: ((event: unknown, ctx: any) => Promise<void>) | undefined;

	const pi = {
		registerCommand(name: string, options: { handler: (args: string, ctx: any) => Promise<void> }) {
			commands.set(name, options);
		},
		on(event: string, handler: (event: unknown, ctx: any) => Promise<void>) {
			if (event === "session_start") startupHandler = handler;
		},
		appendEntry() {},
	} as any;

	workflowsExtension(pi);
	assert.ok(startupHandler);
	assert.ok(commands.has("workflow"));

	const ctx = {
		hasUI: true,
		ui: {
			setWidget(key: string, lines: string[]) {
				widgets.push({ key, lines });
			},
			notify() {},
		},
		sessionManager: {
			getBranch() {
				return [];
			},
		},
		workflowArtifacts: {
			findActiveRun: async () => "/tmp/demo-run",
			deriveWorkflowSummaryFromArtifacts: async () => ({
				workflow: "alignment",
				runDirectory: "/tmp/demo-run",
				state: "task-execution",
				done: false,
			}),
			switchWorkflow: async () => {
				throw new Error("should not switch while alignment is unfinished");
			},
		},
	};

	await startupHandler?.({}, ctx);
	await commands.get("workflow")?.handler("superpowers", ctx);

	assert.deepEqual(widgets.at(-1)?.lines, ["Workflow: alignment", "State: task-execution"]);
});
