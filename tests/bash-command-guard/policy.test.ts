import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
	normalizeCommand,
	splitCommandSegments,
	extractRedirectionTargets,
	matchesExact,
	matchesPrefix,
	matchesTemplate,
} from "../../extensions/bash-command-guard/policy";

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
