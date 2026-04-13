import { strict as assert } from "node:assert";
import { test } from "node:test";
import bashCommandGuard from "../../extensions/bash-command-guard";

test("blocks unknown bash commands when no UI is available", async () => {
	let toolCallHandler: any;
	const pi = {
		on(event: string, handler: any) {
			if (event === "tool_call") toolCallHandler = handler;
		},
	} as any;

	bashCommandGuard(pi);

	const result = await toolCallHandler(
		{ toolName: "bash", input: { command: "rm -rf /tmp/demo" } },
		{ hasUI: false, cwd: "/tmp", ui: {} },
	);

	assert.deepEqual(result, { block: true, reason: "Blocked by user" });
});
