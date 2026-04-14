import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
	normalizeCommand,
	splitCommandSegments,
	extractRedirectionTargets,
	matchesExact,
	matchesPrefix,
	matchesTemplate,
} from "../../extensions/guards/bash-command-guard/policy";
import { evaluateCommandPolicy } from "../../extensions/guards/bash-command-guard/engine";

test("command boundaries are split conservatively", () => {
	assert.deepEqual(splitCommandSegments('pnpm run test && echo done'), ["pnpm run test", "echo done"]);
	assert.deepEqual(splitCommandSegments('cat a.txt | sort | uniq'), ["cat a.txt", "sort", "uniq"]);
	assert.deepEqual(splitCommandSegments('cd src; pnpm test'), ["cd src", "pnpm test"]);
});

test("normalize and exact matching use normalized strings", () => {
	assert.equal(normalizeCommand('  pnpm   run test  '), "pnpm run test");
	assert.equal(matchesExact('pnpm run test', 'pnpm run test'), true);
	assert.equal(matchesExact('pnpm run test ', 'pnpm run test'), true);
});

test("prefix matching is plain string prefix", () => {
	assert.equal(matchesPrefix('pnpm run test -t "abc" path/to/file', "pnpm run test"), true);
	assert.equal(matchesPrefix('pnpm run build', "pnpm run test"), false);
});

test("template matching supports placeholders", () => {
	assert.equal(
		matchesTemplate(
			'pnpm run --filter=foo dev --watch',
			'pnpm run --filter={value} dev {args}',
		),
		true,
	);
});

test("redirections are extracted without splitting the command", () => {
	assert.deepEqual(splitCommandSegments('pnpm run test > out.log 2>> err.log'), ["pnpm run test > out.log 2>> err.log"]);
	assert.deepEqual(extractRedirectionTargets('pnpm run test > out.log 2>> err.log'), ["out.log", "err.log"]);
});

test("evaluateCommandPolicy marks all segments allowed when each segment matches allowlist", async () => {
	const result = await evaluateCommandPolicy("cd folder && pnpm build", {
		cwd: "/tmp",
		allowlist: { exact: ["cd folder", "pnpm build"], prefixes: [], templates: [] },
	});

	assert.equal(result.allowed, true);
	assert.deepEqual(
		result.segments.map((segment) => ({ command: segment.command, allowed: segment.allowed })),
		[
			{ command: "cd folder", allowed: true },
			{ command: "pnpm build", allowed: true },
		],
	);
});

test("evaluateCommandPolicy marks only missing segments as disallowed", async () => {
	const result = await evaluateCommandPolicy("cd folder && pnpm install && pnpm build", {
		cwd: "/tmp",
		allowlist: { exact: ["cd folder", "pnpm build"], prefixes: [], templates: [] },
	});

	assert.equal(result.allowed, false);
	assert.deepEqual(
		result.segments.map((segment) => ({ command: segment.command, allowed: segment.allowed })),
		[
			{ command: "cd folder", allowed: true },
			{ command: "pnpm install", allowed: false },
			{ command: "pnpm build", allowed: true },
		],
	);
});

test("evaluateCommandPolicy normalizes tokens per segment", async () => {
	const result = await evaluateCommandPolicy("  pnpm   install  && ls   -l node_modules  ", {
		cwd: "/tmp",
		allowlist: { exact: [], prefixes: [], templates: [] },
	});

	assert.deepEqual(
		result.segments.map((segment) => ({
			normalizedCommand: segment.normalizedCommand,
			normalizedTokens: segment.normalizedTokens,
		})),
		[
			{ normalizedCommand: "pnpm install", normalizedTokens: ["pnpm", "install"] },
			{ normalizedCommand: "ls -l node_modules", normalizedTokens: ["ls", "-l", "node_modules"] },
		],
	);
});
