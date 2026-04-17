import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { TaskState } from "../../extensions/workflows/state/task-state.ts";
import { applyReviewCommit } from "../../extensions/workflows/tools/review-commit.ts";

function runGit(cwd: string, args: string[]): string {
	return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function initRepo(): string {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "review-commit-"));
	runGit(cwd, ["init"]);
	runGit(cwd, ["config", "user.email", "test@example.com"]);
	runGit(cwd, ["config", "user.name", "Test User"]);
	return cwd;
}

afterEach((context) => {
	const cwd = (context as unknown as { cwd?: string }).cwd;
	if (cwd) fs.rmSync(cwd, { recursive: true, force: true });
});

describe("applyReviewCommit", () => {
	it("creates a commit when review completion still has uncommitted changes", () => {
		const cwd = initRepo();
		const filePath = path.join(cwd, "change.txt");
		fs.writeFileSync(filePath, "change\n");

		const taskState = new TaskState();
		taskState.addTask({
			summary: "Implement review-owned commit behavior",
			description: "Task description",
			alignmentNeeded: true,
		});

		const result = applyReviewCommit({
			cwd,
			taskState,
			taskId: "01-implement-review-owned-commit-behavior",
			commitMessage: "feat(workflows): review-owned commit",
		});

		assert.equal(result.committed, true);
		assert.equal(result.skipped, false);
		assert.equal(result.commitHash, runGit(cwd, ["rev-parse", "HEAD"]));
		assert.deepEqual(taskState.tasks[0].commitHashes, [result.commitHash]);
		assert.equal(taskState.tasks[0].status, "committed");
	});

	it("does not create a duplicate commit when the human already committed", () => {
		const cwd = initRepo();
		const filePath = path.join(cwd, "change.txt");
		fs.writeFileSync(filePath, "change\n");
		runGit(cwd, ["add", "-A"]);
		runGit(cwd, ["commit", "-m", "feat(workflows): human committed it"]);
		const existingHash = runGit(cwd, ["rev-parse", "HEAD"]);

		const taskState = new TaskState();
		taskState.addTask({
			summary: "Implement review-owned commit behavior",
			description: "Task description",
			alignmentNeeded: true,
		});

		const result = applyReviewCommit({
			cwd,
			taskState,
			taskId: "01-implement-review-owned-commit-behavior",
			commitHash: existingHash,
		});

		assert.equal(result.committed, false);
		assert.equal(result.skipped, false);
		assert.equal(result.commitHash, existingHash);
		assert.deepEqual(taskState.tasks[0].commitHashes, [existingHash]);
		assert.equal(taskState.tasks[0].status, "committed");
		assert.equal(runGit(cwd, ["rev-parse", "HEAD"]), existingHash);
	});

	it("records the existing HEAD hash when review exits with a clean tree", () => {
		const cwd = initRepo();
		runGit(cwd, ["commit", "--allow-empty", "-m", "feat(workflows): initial state"]);
		const initialHash = runGit(cwd, ["rev-parse", "HEAD"]);

		const taskState = new TaskState();
		taskState.addTask({
			summary: "Implement review-owned commit behavior",
			description: "Task description",
			alignmentNeeded: true,
		});

		const result = applyReviewCommit({
			cwd,
			taskState,
			taskId: "01-implement-review-owned-commit-behavior",
			commitIntent: "create",
			commitMessage: "feat(workflows): review-owned commit",
		});

		assert.equal(result.committed, false);
		assert.equal(result.skipped, false);
		assert.equal(result.commitHash, initialHash);
		assert.deepEqual(taskState.tasks[0].commitHashes, [initialHash]);
		assert.equal(taskState.tasks[0].status, "committed");
		assert.equal(runGit(cwd, ["rev-parse", "HEAD"]), initialHash);
	});
});
