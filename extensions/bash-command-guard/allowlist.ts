import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createJsonStore } from "../shared/json-store";
import type { CommandAllowlist } from "./types";

const CONFIG_DIR = process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".pi", "agent");
const ALLOWLIST_FILE = path.join(CONFIG_DIR, "bash-command-allowlist.json");

const store = createJsonStore<CommandAllowlist>(ALLOWLIST_FILE, {
	defaultValue: { exact: [], prefixes: [], templates: [] },
	merge(current, next) {
		return {
			exact: [...new Set([...current.exact, ...next.exact])],
			prefixes: [...new Set([...current.prefixes, ...next.prefixes])],
			templates: [...new Set([...current.templates, ...next.templates])],
		};
	},
});

export function normalizeAllowlist(raw: Partial<CommandAllowlist> | undefined): CommandAllowlist {
	return {
		exact: Array.isArray(raw?.exact) ? raw.exact : [],
		prefixes: Array.isArray(raw?.prefixes) ? raw.prefixes : [],
		templates: Array.isArray(raw?.templates) ? raw.templates : [],
	};
}

export async function loadCommandAllowlist() {
	return normalizeAllowlist(await store.load());
}

export async function saveCommandAllowlist(next: Partial<CommandAllowlist>) {
	const current = await loadCommandAllowlist();
	return store.save({
		exact: [...current.exact, ...(next.exact ?? [])],
		prefixes: [...current.prefixes, ...(next.prefixes ?? [])],
		templates: [...current.templates, ...(next.templates ?? [])],
	});
}
