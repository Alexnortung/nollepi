import fs from "node:fs/promises";
import path from "node:path";

export function createJsonStore<T>(
	filePath: string,
	opts: {
		defaultValue: T;
		merge(current: T, next: T): T;
	},
) {
	let cache: T | null = null;

	async function load() {
		if (cache) return cache;

		try {
			const raw = await fs.readFile(filePath, "utf8");
			cache = JSON.parse(raw) as T;
		} catch {
			cache = opts.defaultValue;
		}

		return cache;
	}

	async function reload() {
		cache = null;
		return load();
	}

	async function save(next: T) {
		const current = await reload();
		const merged = opts.merge(current, next);
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		await fs.writeFile(filePath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
		cache = merged;
		return merged;
	}

	return { load, reload, save };
}
