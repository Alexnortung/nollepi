import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createJsonStore } from "../extensions/guards/shared/json-store";
import {
	buildDirectoryChoices,
	matchesAllowlist,
	maybePromptForAccess,
	normalizeAllowlist,
	promptPathAccess,
	savePathAllowlistDirectory,
	savePathAllowlistEntry,
} from "../extensions/guards/path-guard.ts";

test("path allowlist still matches files and directories", () => {
	const allowlist = normalizeAllowlist({
		files: ["/tmp/a.txt"],
		directories: ["/tmp/projects"],
	});

	assert.equal(matchesAllowlist(allowlist, "/tmp/a.txt"), true);
	assert.equal(matchesAllowlist(allowlist, "/tmp/projects/demo/file.ts"), true);
	assert.equal(matchesAllowlist(allowlist, "/tmp/other/file.ts"), false);
});

test("reloading before saving preserves manual file edits", async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "path-guard-"));
	const file = path.join(dir, "allowlist.json");
	const store = createJsonStore<{ files: string[]; directories: string[] }>(file, {
		defaultValue: { files: [], directories: [] },
		merge(current, next) {
			return {
				files: [...new Set([...current.files, ...next.files])],
				directories: [...new Set([...current.directories, ...next.directories])],
			};
		},
	});

	await fs.writeFile(file, JSON.stringify({ files: ["/tmp/manual.txt"], directories: [] }), "utf8");
	await savePathAllowlistEntry(store, "file", "/tmp/new.txt");

	const final = JSON.parse(await fs.readFile(file, "utf8")) as { files: string[]; directories: string[] };
	assert.deepEqual(final, {
		files: ["/tmp/manual.txt", "/tmp/new.txt"],
		directories: [],
	});
});

test("reloading before saving preserves manual directory edits", async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "path-guard-"));
	const file = path.join(dir, "allowlist.json");
	const store = createJsonStore<{ files: string[]; directories: string[] }>(file, {
		defaultValue: { files: [], directories: [] },
		merge(current, next) {
			return {
				files: [...new Set([...current.files, ...next.files])],
				directories: [...new Set([...current.directories, ...next.directories])],
			};
		},
	});

	await fs.writeFile(file, JSON.stringify({ files: [], directories: ["/tmp/manual"] }), "utf8");
	await savePathAllowlistEntry(store, "directory", "/tmp/new/project/file.txt");

	const final = JSON.parse(await fs.readFile(file, "utf8")) as { files: string[]; directories: string[] };
	assert.deepEqual(final, {
		files: [],
		directories: ["/tmp/manual", "/tmp/new/project"],
	});
});

test("buildDirectoryChoices lists parent directories nearest-first for file targets", () => {
	assert.deepEqual(buildDirectoryChoices("/tmp/demo/project/file.txt"), [
		"/tmp/demo/project",
		"/tmp/demo",
		"/tmp",
	]);
});

test("buildDirectoryChoices includes the target directory itself", () => {
	assert.deepEqual(buildDirectoryChoices("/tmp/demo/project", { isDirectory: true }), [
		"/tmp/demo/project",
		"/tmp/demo",
		"/tmp",
	]);
});

test("savePathAllowlistDirectory preserves manual directory edits and writes the exact selected parent", async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "path-guard-"));
	const file = path.join(dir, "allowlist.json");
	const store = createJsonStore<{ files: string[]; directories: string[] }>(file, {
		defaultValue: { files: [], directories: [] },
		merge(current, next) {
			return {
				files: [...new Set([...current.files, ...next.files])],
				directories: [...new Set([...current.directories, ...next.directories])],
			};
		},
	});

	await fs.writeFile(file, JSON.stringify({ files: [], directories: ["/tmp/manual"] }), "utf8");
	await savePathAllowlistDirectory(store, "/tmp/new");

	const final = JSON.parse(await fs.readFile(file, "utf8")) as { files: string[]; directories: string[] };
	assert.deepEqual(final, {
		files: [],
		directories: ["/tmp/manual", "/tmp/new"],
	});
});

test("maybePromptForAccess saves the selected parent directory from the second prompt", async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "path-guard-"));
	const file = path.join(dir, "allowlist.json");
	const store = createJsonStore<{ files: string[]; directories: string[] }>(file, {
		defaultValue: { files: [], directories: [] },
		merge(current, next) {
			return {
				files: [...new Set([...current.files, ...next.files])],
				directories: [...new Set([...current.directories, ...next.directories])],
			};
		},
	});

	const prompts: Array<{ message: string; options: string[] }> = [];
	const result = await maybePromptForAccess(
		{ toolName: "read", input: { path: "/tmp/demo/project/file.txt" } },
		{
			hasUI: true,
			cwd: "/worktree",
			ui: {
				async select(message: string, options: string[]) {
					prompts.push({ message, options });
					if (prompts.length === 1) return "Always allow this directory";
					return "/tmp/demo";
				},
				notify() {},
			},
		},
		store,
	);

	assert.equal(result, undefined);
	assert.deepEqual(prompts[1]?.options, ["/tmp/demo/project", "/tmp/demo", "/tmp"]);

	const final = JSON.parse(await fs.readFile(file, "utf8")) as { files: string[]; directories: string[] };
	assert.deepEqual(final, {
		files: [],
		directories: ["/tmp/demo"],
	});
});

test("promptPathAccess allows once without persisting", async () => {
	const saved: any[] = [];
	const ui = {
		async select() {
			return "Allow once";
		},
		notify() {},
	};

	const result = await promptPathAccess(
		{ reload: async () => ({ files: [], directories: [] }), save: async (next) => { saved.push(next); return next; } },
		ui,
		"/tmp/out.log",
	);

	assert.equal(result, true);
	assert.deepEqual(saved, []);
});

test("promptPathAccess saves file approval when requested", async () => {
	let saved: any;
	const ui = {
		async select() {
			return "Always allow this file";
		},
		notify() {},
	};

	const result = await promptPathAccess(
		{ reload: async () => ({ files: [], directories: [] }), save: async (next) => { saved = next; return next; } },
		ui,
		"/tmp/out.log",
	);

	assert.equal(result, true);
	assert.deepEqual(saved.files, ["/tmp/out.log"]);
});

test("path guard allows any path after workflow:switched autonomous is emitted", async () => {
	const listeners = new Map<string, Array<(data: any) => void>>();
	let toolCallHandler: any;

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

	const { default: pathGuardDefault } = await import("../extensions/guards/path-guard.ts");
	pathGuardDefault(pi);

	pi.events.emit("workflow:switched", { workflow: "autonomous" });

	const result = await toolCallHandler(
		{ toolName: "write", input: { path: "/arbitrary/outside/cwd/file.ts" } },
		{
			hasUI: true,
			cwd: "/project",
			ui: { async select() { return "Deny"; }, notify() {} },
		},
	);

	assert.equal(result, undefined);
});
