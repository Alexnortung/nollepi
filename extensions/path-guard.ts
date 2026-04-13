import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type Allowlist = {
	files: string[];
	directories: string[];
};

const CONFIG_DIR = process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".pi", "agent");
const ALLOWLIST_FILE = path.join(CONFIG_DIR, "path-guard-allowlist.json");

let allowlistCache: Allowlist | null = null;

function stripAtPrefix(value: string) {
	return value.startsWith("@") ? value.slice(1) : value;
}

async function canonicalize(target: string) {
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

function normalizeAllowlist(raw: Partial<Allowlist> | undefined): Allowlist {
	return {
		files: Array.isArray(raw?.files) ? raw.files.map(normalizeStoredPath) : [],
		directories: Array.isArray(raw?.directories) ? raw.directories.map(normalizeStoredPath) : [],
	};
}

async function loadAllowlist() {
	if (allowlistCache) return allowlistCache;

	try {
		const raw = await fs.readFile(ALLOWLIST_FILE, "utf8");
		allowlistCache = normalizeAllowlist(JSON.parse(raw) as Partial<Allowlist>);
	} catch {
		allowlistCache = { files: [], directories: [] };
	}

	return allowlistCache;
}

async function saveAllowlist(allowlist: Allowlist) {
	const next = {
		files: [...new Set(allowlist.files)],
		directories: [...new Set(allowlist.directories)],
	};

	await fs.mkdir(path.dirname(ALLOWLIST_FILE), { recursive: true });
	await fs.writeFile(ALLOWLIST_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
	allowlistCache = next;
}

function matchesAllowlist(allowlist: Allowlist, target: string) {
	if (allowlist.files.includes(target)) return true;
	return allowlist.directories.some((directory) => isInside(directory, target));
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

	const cwd = await canonicalize(ctx.cwd);
	const target = await canonicalize(rawPath);

	if (isInside(cwd, target)) {
		return undefined;
	}

	const allowlist = await loadAllowlist();
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
			await saveAllowlist({
				files: [...allowlist.files, target],
				directories: allowlist.directories,
			});
		} catch {
			ctx.ui.notify(`Could not save allowlist; allowing once for ${target}`, "warning");
		}
		return undefined;
	}

	if (choice === "Always allow this directory") {
		const directory = await canonicalize(path.dirname(target));
		try {
			await saveAllowlist({
				files: allowlist.files,
				directories: [...allowlist.directories, directory],
			});
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
