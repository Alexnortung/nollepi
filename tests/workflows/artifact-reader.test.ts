import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseWorkflowMd, parseTaskMd } from "../../extensions/workflows/artifacts/reader.ts";

describe("artifact reader", () => {
	it("parses workflow ledger task statuses and commits", () => {
		const markdown = `# Button variants

- Workflow type: alignment
- Workflow state: task-execution
- Run id: 2026-04-16-01-alignment-button-variants

## Tasks
- [approved] 01-update-domain-types — Update domain types
  - Commits: abc123, def456
- [proposed] 02-migrate-button-usage — Migrate button usage
`;

		const parsed = parseWorkflowMd(markdown);
		assert.equal(parsed.workflowType, "alignment");
		assert.equal(parsed.workflowState, "task-execution");
		assert.equal(parsed.tasks[0].id, "01-update-domain-types");
		assert.deepEqual(parsed.tasks[0].commitHashes, ["abc123", "def456"]);
	});

	it("parses task dossier steps", () => {
		const markdown = `# Update domain types

- Task id: 01-update-domain-types
- Status: approved
- Alignment needed: true
- Commits: abc123

## Description
Commit-worthy change

## Steps
1. [pending] Change exported types
2. [done] Update callers (step-2-update-callers.md)
`;

		const parsed = parseTaskMd(markdown);
		assert.equal(parsed.id, "01-update-domain-types");
		assert.equal(parsed.status, "approved");
		assert.equal(parsed.steps.length, 2);
		assert.equal(parsed.steps[1].artifactPath, "step-2-update-callers.md");
	});
});
