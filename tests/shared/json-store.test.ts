import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createJsonStore } from "../../extensions/shared/json-store";

test("reloads from disk before save so concurrent edits are merged", async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "json-store-"));
	const file = path.join(dir, "allowlist.json");
	const store = createJsonStore<{ entries: string[] }>(file, {
		defaultValue: { entries: [] },
		merge(current, next) {
			return { entries: [...new Set([...current.entries, ...next.entries])] };
		},
	});

	await store.save({ entries: ["alpha"] });
	await fs.writeFile(file, JSON.stringify({ entries: ["alpha", "beta"] }), "utf8");
	await store.save({ entries: ["gamma"] });

	const final = JSON.parse(await fs.readFile(file, "utf8")) as { entries: string[] };
	assert.deepEqual(final, { entries: ["alpha", "beta", "gamma"] });
});
