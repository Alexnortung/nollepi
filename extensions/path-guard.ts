import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createJsonStore } from "./shared/json-store";

export type PathAllowlist = {
	files: string[];
	directories: string[];
};

export function getPathAllowlistStore() {
	const configDir = process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".pi", "agent");
	const allowlistFile = path.join(configDir, "path-guard-allowlist.json");
	return createJsonStore<PathAllowlist>(allowlistFile, {
		defaultValue: { files: [], directories: [] },
		merge(current, next) {
			return {
				files: [...new Set([...current.files, ...next.files])],
				directories: [...new Set([...current.directories, ...next.directories])],
			};
		},
	});
}

function stripAtPrefix(value: string) {
	return value.startsWith("@") ? value.slice(1) : value;
}

export async function canonicalizePath(target: string) {
	const resolved = path.resolve(stripAtPrefix(target));
	try {
		return await fs.realpath(resolved);
	} catch {
		return resolved;
	}
}

function isInside(parent: string, child: string) {
	const relative = path.relative(parent, child);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeStoredPath(value: string) {
	return path.resolve(stripAtPrefix(value));
}

export function normalizeAllowlist(raw: Partial<PathAllowlist> | undefined): PathAllowlist {
	return {
		files: Array.isArray(raw?.files) ? raw.files.map(normalizeStoredPath) : [],
		directories: Array.isArray(raw?.directories) ? raw.directories.map(normalizeStoredPath) : [],
	};
}

export function matchesAllowlist(allowlist: PathAllowlist, target: string) {
	if (allowlist.files.includes(target)) return true;
	return allowlist.directories.some((directory) => isInside(directory, target));
}

export function buildDirectoryChoices(target: string, input?: { isDirectory?: boolean }) {
	const start = input?.isDirectory ? target : path.dirname(target);
	const choices: string[] = [];
	let current = start;

	while (current !== path.dirname(current)) {
		choices.push(current);
		current = path.dirname(current);
	}

	return choices;
}

export async function loadPathAllowlist() {
	return normalizeAllowlist(await getPathAllowlistStore().load());
}

export type PathAllowlistStore = {
	reload(): Promise<PathAllowlist>;
	save(next: PathAllowlist): Promise<PathAllowlist>;
};

export async function savePathAllowlistDirectory(storeApi: PathAllowlistStore, directory: string) {
	const allowlist = normalizeAllowlist(await storeApi.reload());
	return storeApi.save({
		files: allowlist.files,
		directories: [...allowlist.directories, directory],
	});
}

async function detectDirectoryTarget(target: string) {
	try {
		return (await fs.stat(target)).isDirectory();
	} catch {
		return false;
	}
}

export async function savePathAllowlistEntry(
	storeApi: PathAllowlistStore,
	kind: "file" | "directory",
	target: string,
) {
	const allowlist = normalizeAllowlist(await storeApi.reload());
	if (kind === "file") {
		return storeApi.save({
			files: [...allowlist.files, target],
			directories: allowlist.directories,
		});
	}

	const directory = await canonicalizePath(path.dirname(target));
	return savePathAllowlistDirectory(storeApi, directory);
}

export async function promptPathAccess(
	storeApi: PathAllowlistStore,
	ui: any,
	target: string,
	message = `Allow path outside cwd?\n\n${target}`,
) {
	const choice = await ui.select(message, [
		"Deny",
		"Allow once",
		"Always allow this file",
		"Always allow this directory",
	]);

	if (!choice || choice === "Deny") return false;
	if (choice === "Allow once") return true;

	if (choice === "Always allow this file") {
		try {
			await savePathAllowlistEntry(storeApi, "file", target);
		} catch {
			ui.notify(`Could not save allowlist; allowing once for ${target}`, "warning");
		}
		return true;
	}

	if (choice === "Always allow this directory") {
		const directories = buildDirectoryChoices(target, {
			isDirectory: await detectDirectoryTarget(target),
		});
		if (!directories.length) {
			return false;
		}

		const selectedDirectory = await ui.select("Choose directory to always allow", directories);
		if (!selectedDirectory) {
			return false;
		}

		try {
			await savePathAllowlistDirectory(storeApi, selectedDirectory);
		} catch {
			ui.notify(`Could not save allowlist; allowing once for ${target}`, "warning");
		}
		return true;
	}

	return false;
}

export async function maybePromptForAccess(
	event: { toolName: string; input: { path?: unknown } },
	ctx: any,
	storeApi: PathAllowlistStore = getPathAllowlistStore(),
) {
	if (event.toolName !== "read" && event.toolName !== "write" && event.toolName !== "edit") {
		return undefined;
	}

	const rawPath = typeof event.input.path === "string" ? event.input.path : undefined;
	if (!rawPath) {
		return { block: true, reason: "Missing file path" };
	}

	const cwd = await canonicalizePath(ctx.cwd);
	const target = await canonicalizePath(rawPath);

	if (isInside(cwd, target)) {
		return undefined;
	}

	const allowlist = normalizeAllowlist(await storeApi.reload());
	if (matchesAllowlist(allowlist, target)) {
		return undefined;
	}

	if (!ctx.hasUI) {
		return { block: true, reason: `Path outside cwd is not allowlisted: ${target}` };
	}

	const allowed = await promptPathAccess(
		storeApi,
		ctx.ui,
		target,
		[
			`Tool: ${event.toolName}`,
			`Path: ${target}`,
			`CWD: ${cwd}`,
			"Allow this access?",
		].join("\n"),
	);

	return allowed ? undefined : { block: true, reason: "Blocked by user" };
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => maybePromptForAccess(event as any, ctx));
}
