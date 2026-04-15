import { strict as assert } from "node:assert";
import test from "node:test";
import workflowsExtension from "../../extensions/workflows/index";
import type { WorkflowRunSummary } from "../../extensions/workflows/shared/types";

function makeTestDeps(overrides: {
	activeRun?: string;
	summary?: Partial<WorkflowRunSummary>;
	switchResult?: Partial<WorkflowRunSummary>;
}) {
	return {
		findActiveRun: async () => overrides.activeRun,
		deriveWorkflowSummaryFromArtifacts: async (_dir: string): Promise<WorkflowRunSummary> => ({
			workflow: "alignment" as const,
			runDirectory: overrides.activeRun,
			state: "task-execution",
			done: false,
			...overrides.summary,
		}),
		switchWorkflow: async (_input: { cwd: string; workflow: any; title?: string }): Promise<WorkflowRunSummary> => ({
			workflow: "alignment" as const,
			state: "intake",
			done: false,
			...overrides.switchResult,
		}),
	};
}

test("session_start restores widget from active run artifact", async () => {
	const widgets: Array<{ key: string; lines: string[] }> = [];
	let startupHandler: ((event: unknown, ctx: any) => Promise<void>) | undefined;

	const pi = {
		registerCommand() {},
		on(event: string, handler: (event: unknown, ctx: any) => Promise<void>) {
			if (event === "session_start") startupHandler = handler;
		},
		appendEntry() {},
		events: { emit() {}, on() {} },
	} as any;

	workflowsExtension(pi, makeTestDeps({ activeRun: "/tmp/demo-run" }));

	const ctx = {
		hasUI: true,
		cwd: "/project",
		ui: { setWidget(key: string, lines: string[]) { widgets.push({ key, lines }); } },
		sessionManager: { getBranch: () => [] },
	};

	await startupHandler?.({}, ctx);
	assert.deepEqual(widgets.at(-1)?.lines, ["Workflow: alignment", "State: task-execution"]);
});

test("session_start shows idle base widget when no active run exists", async () => {
	const widgets: Array<{ key: string; lines: string[] }> = [];
	let startupHandler: ((event: unknown, ctx: any) => Promise<void>) | undefined;

	const pi = {
		registerCommand() {},
		on(event: string, handler: (event: unknown, ctx: any) => Promise<void>) {
			if (event === "session_start") startupHandler = handler;
		},
		appendEntry() {},
		events: { emit() {}, on() {} },
	} as any;

	workflowsExtension(pi, makeTestDeps({ activeRun: undefined }));

	const ctx = {
		hasUI: true,
		cwd: "/project",
		ui: { setWidget(key: string, lines: string[]) { widgets.push({ key, lines }); } },
		sessionManager: { getBranch: () => [] },
	};

	await startupHandler?.({}, ctx);
	assert.deepEqual(widgets.at(-1)?.lines, ["Workflow: base", "State: idle"]);
});

test("workflow command blocks switching from unfinished alignment", async () => {
	const commands = new Map<string, { handler: (args: string, ctx: any) => Promise<void> }>();
	const notifications: string[] = [];

	const pi = {
		registerCommand(name: string, options: { handler: (args: string, ctx: any) => Promise<void> }) {
			commands.set(name, options);
		},
		on() {},
		appendEntry() {},
		events: { emit() {}, on() {} },
	} as any;

	workflowsExtension(pi, makeTestDeps({ activeRun: "/tmp/demo-run", summary: { done: false } }));

	const ctx = {
		hasUI: true,
		cwd: "/project",
		ui: { setWidget() {}, notify(m: string) { notifications.push(m); } },
		sessionManager: { getBranch: () => [] },
	};

	await commands.get("workflow")?.handler("superpowers", ctx);
	assert.match(notifications.at(-1) ?? "", /cannot switch/i);
});

test("workflow command refuses autonomous when sandbox unavailable", async () => {
	const commands = new Map<string, { handler: (args: string, ctx: any) => Promise<void> }>();
	const notifications: string[] = [];

	const pi = {
		registerCommand(name: string, options: { handler: (args: string, ctx: any) => Promise<void> }) {
			commands.set(name, options);
		},
		on() {},
		appendEntry() {},
		events: { emit() {}, on() {} },
	} as any;

	workflowsExtension(pi, makeTestDeps({ activeRun: undefined }));

	const ctx = {
		hasUI: true,
		cwd: "/project",
		sandboxAvailable: false,
		worktreeReady: true,
		ui: { setWidget() {}, notify(m: string) { notifications.push(m); } },
		sessionManager: { getBranch: () => [] },
	};

	await commands.get("workflow")?.handler("autonomous", ctx);
	assert.match(notifications.at(-1) ?? "", /sandbox/i);
});
