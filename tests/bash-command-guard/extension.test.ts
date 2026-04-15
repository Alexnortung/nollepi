import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { strict as assert } from "node:assert";
import { before, beforeEach, test } from "node:test";
import bashCommandGuard from "../../extensions/guards/bash-command-guard.ts";

let tempDir = "";

before(async () => {
	tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bash-command-guard-"));
	process.env.PI_CODING_AGENT_DIR = tempDir;
});

beforeEach(async () => {
	await fs.writeFile(
		path.join(tempDir, "bash-command-allowlist.json"),
		JSON.stringify({ exact: [], prefixes: [], templates: [] }),
		"utf8",
	);
	await fs.writeFile(
		path.join(tempDir, "path-guard-allowlist.json"),
		JSON.stringify({ files: [], directories: [] }),
		"utf8",
	);
});

function registerGuard() {
	let toolCallHandler: any;
	const pi = {
		on(event: string, handler: any) {
			if (event === "tool_call") toolCallHandler = handler;
		},
		events: { on() {}, emit() {} },
	} as any;
	bashCommandGuard(pi);
	return toolCallHandler;
}

function registerGuardWithEventBus() {
	let toolCallHandler: any;
	const listeners = new Map<string, Array<(data: any) => void>>();
	const pi = {
		on(event: string, handler: any) {
			if (event === "tool_call") toolCallHandler = handler;
		},
		events: {
			on(event: string, cb: (data: any) => void) {
				if (!listeners.has(event)) listeners.set(event, []);
				listeners.get(event)!.push(cb);
			},
			emit(event: string, data: any) {
				listeners.get(event)?.forEach((cb) => cb(data));
			},
		},
	} as any;
	bashCommandGuard(pi);
	return { toolCallHandler, events: pi.events };
}

test("blocks unknown bash commands when no UI is available", async () => {
	const toolCallHandler = registerGuard();
	const result = await toolCallHandler(
		{ toolName: "bash", input: { command: "rm -rf /tmp/demo" } },
		{ hasUI: false, cwd: "/tmp", ui: {} },
	);

	assert.deepEqual(result, { block: true, reason: "Blocked by user" });
});

test("prompts only for missing segments in order", async () => {
	const prompts: string[] = [];
	await fs.writeFile(
		path.join(tempDir, "bash-command-allowlist.json"),
		JSON.stringify({ exact: ["cd folder"], prefixes: [], templates: [] }),
		"utf8",
	);
	const toolCallHandler = registerGuard();

	const result = await toolCallHandler(
		{ toolName: "bash", input: { command: "cd folder && pnpm install && pnpm build" } },
		{
			hasUI: true,
			cwd: tempDir,
			ui: {
				async select(message: string) {
					prompts.push(message);
					return "Allow once";
				},
				notify() {},
			},
		},
	);

	assert.equal(result, undefined);
	assert.deepEqual(prompts, [
		"Allow bash command segment?\n\npnpm install",
		"Allow bash command segment?\n\npnpm build",
	]);
});

test("denying a later segment blocks the full command", async () => {
	const responses = ["Allow once", "Deny"];
	const toolCallHandler = registerGuard();

	const result = await toolCallHandler(
		{ toolName: "bash", input: { command: "pnpm install && pnpm build" } },
		{
			hasUI: true,
			cwd: tempDir,
			ui: {
				async select() {
					return responses.shift();
				},
				notify() {},
			},
		},
	);

	assert.deepEqual(result, { block: true, reason: "Blocked by user" });
});

test("always allow exact command saves only the selected segment", async () => {
	const toolCallHandler = registerGuard();

	const result = await toolCallHandler(
		{ toolName: "bash", input: { command: "cd folder && pnpm install" } },
		{
			cwd: tempDir,
			hasUI: true,
			ui: {
				async select(message: string) {
					return message.includes("pnpm install") ? "Always allow exact command" : "Allow once";
				},
				notify() {},
			},
		},
	);

	assert.equal(result, undefined);
	const saved = JSON.parse(await fs.readFile(path.join(tempDir, "bash-command-allowlist.json"), "utf8"));
	assert.deepEqual(saved.exact, ["pnpm install"]);
	assert.deepEqual(saved.prefixes, []);
});

test("always allow prefix saves only the selected segment prefix", async () => {
	const toolCallHandler = registerGuard();

	const result = await toolCallHandler(
		{ toolName: "bash", input: { command: "cd folder && pnpm run build --watch" } },
		{
			cwd: tempDir,
			hasUI: true,
			ui: {
				async select(message: string) {
					if (message.includes("pnpm run build --watch")) return "Always allow prefix";
					if (message === "Choose prefix span") return "pnpm run";
					return "Allow once";
				},
				notify() {},
			},
		},
	);

	assert.equal(result, undefined);
	const saved = JSON.parse(await fs.readFile(path.join(tempDir, "bash-command-allowlist.json"), "utf8"));
	assert.deepEqual(saved.exact, []);
	assert.deepEqual(saved.prefixes, ["pnpm run"]);
});

test("path-allowlisted redirection targets do not prompt", async () => {
	const prompts: string[] = [];
	const outLog = path.join(tempDir, "out.log");
	await fs.writeFile(
		path.join(tempDir, "bash-command-allowlist.json"),
		JSON.stringify({ exact: [`echo hi > ${outLog}`], prefixes: [], templates: [] }),
		"utf8",
	);
	await fs.writeFile(
		path.join(tempDir, "path-guard-allowlist.json"),
		JSON.stringify({ files: [outLog], directories: [] }),
		"utf8",
	);
	const toolCallHandler = registerGuard();

	const result = await toolCallHandler(
		{ toolName: "bash", input: { command: `echo hi > ${outLog}` } },
		{
			hasUI: true,
			cwd: tempDir,
			ui: {
				async select(message: string) {
					prompts.push(message);
					return "Deny";
				},
				notify() {},
			},
		},
	);

	assert.equal(result, undefined);
	assert.deepEqual(prompts, []);
});

test("redirection prompts run after command approval for the same segment", async () => {
	const prompts: string[] = [];
	const responses = ["Allow once", "Allow once"];
	const outLog = path.join(tempDir, "out.log");
	const toolCallHandler = registerGuard();

	const result = await toolCallHandler(
		{ toolName: "bash", input: { command: `pnpm build > ${outLog}` } },
		{
			hasUI: true,
			cwd: tempDir,
			ui: {
				async select(message: string) {
					prompts.push(message);
					return responses.shift();
				},
				notify() {},
			},
		},
	);

	assert.equal(result, undefined);
	assert.equal(prompts[0], `Allow bash command segment?\n\npnpm build > ${outLog}`);
	assert.match(prompts[1], /Allow path outside cwd\?\n\n/);
});

test("denying a redirection path blocks the full command", async () => {
	const responses = ["Allow once", "Deny"];
	const outLog = path.join(tempDir, "out.log");
	const toolCallHandler = registerGuard();

	const result = await toolCallHandler(
		{ toolName: "bash", input: { command: `pnpm build > ${outLog} && echo done` } },
		{
			hasUI: true,
			cwd: tempDir,
			ui: {
				async select() {
					return responses.shift();
				},
				notify() {},
			},
		},
	);

	assert.deepEqual(result, { block: true, reason: "Blocked by user" });
});

test("bash guard allows all commands after workflow:switched autonomous is emitted", async () => {
	const { toolCallHandler, events } = registerGuardWithEventBus();

	events.emit("workflow:switched", { workflow: "autonomous" });

	const result = await toolCallHandler(
		{ toolName: "bash", input: { command: "rm -rf /tmp/sandbox-dir" } },
		{ hasUI: true, cwd: "/project", ui: { async select() { return "Deny"; } } },
	);

	assert.equal(result, undefined);
});

test("bash guard resumes prompting after workflow:switched back to alignment", async () => {
	const { toolCallHandler, events } = registerGuardWithEventBus();

	events.emit("workflow:switched", { workflow: "autonomous" });
	events.emit("workflow:switched", { workflow: "alignment" });

	const result = await toolCallHandler(
		{ toolName: "bash", input: { command: "rm -rf /tmp/sandbox-dir" } },
		{ hasUI: false, cwd: "/project", ui: {} },
	);

	assert.deepEqual(result, { block: true, reason: "Blocked by user" });
});
