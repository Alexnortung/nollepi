import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createJsonStore } from "./shared/json-store";

export type PathAllowlist = {
	files: string[];
	directories: string[];
};

const CONFIG_DIR = process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".pi", "agent");
const ALLOWLIST_FILE = path.join(CONFIG_DIR, "path-guard-allowlist.json");

const store = createJsonStore<PathAllowlist>(ALLOWLIST_FILE, {
	defaultValue: { files: [], directories: [] },
	merge(current, next) {
		return {
			files: [...new Set([...current.files, ...next.files])],
			directories: [...new Set([...current.directories, ...next.directories])],
		};
	},
});

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

export async function loadPathAllowlist() {
	return normalizeAllowlist(await store.load());
}

type PathAllowlistStore = {
	reload(): Promise<PathAllowlist>;
	save(next: PathAllowlist): Promise<PathAllowlist>;
};

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
	return storeApi.save({
		files: allowlist.files,
		directories: [...allowlist.directories, directory],
	});
}

async function maybePromptForAccess(
	event: { toolName: string; input: { path?: unknown } },
	ctx: any,
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

	const allowlist = normalizeAllowlist(await store.load());
	if (matchesAllowlist(allowlist, target)) {
		return undefined;
	}

	if (!ctx.hasUI) {
		return { block: true, reason: `Path outside cwd is not allowlisted: ${target}` };
	}

	const choice = await ctx.ui.select(
		[
			`Tool: ${event.toolName}`,
			`Path: ${target}`,
			`CWD: ${cwd}`,
			"Allow this access?",
		].join("\n"),
		[
			"Deny",
			"Allow once",
			"Always allow this file",
			"Always allow this directory",
		],
	);

	if (!choice || choice === "Deny") {
		return { block: true, reason: "Blocked by user" };
	}

	if (choice === "Allow once") {
		return undefined;
	}

	if (choice === "Always allow this file") {
		try {
			await savePathAllowlistEntry(store, "file", target);
		} catch {
			ctx.ui.notify(`Could not save allowlist; allowing once for ${target}`, "warning");
		}
		return undefined;
	}

	if (choice === "Always allow this directory") {
		try {
			await savePathAllowlistEntry(store, "directory", target);
		} catch {
			ctx.ui.notify(`Could not save allowlist; allowing once for ${target}`, "warning");
		}
		return undefined;
	}

	return { block: true, reason: "Blocked by user" };
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => maybePromptForAccess(event as any, ctx));
}
