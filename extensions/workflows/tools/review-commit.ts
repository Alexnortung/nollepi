import { execFileSync } from "node:child_process";
import type { TaskState, WorkflowTask } from "../state/task-state.ts";
import { applyTaskCommit } from "./task-commit.ts";
import type { ReviewCommitIntent } from "./workflow-transition-logic.ts";

export interface ReviewCommitInput {
	cwd: string;
	taskState: TaskState;
	taskId: string;
	commitIntent?: ReviewCommitIntent;
	commitMessage?: string;
	commitHash?: string;
}

export interface ReviewCommitResult {
	commitHash?: string;
	committed: boolean;
	skipped: boolean;
}

function runGit(cwd: string, args: string[]): string {
	return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function hasUncommittedChanges(cwd: string): boolean {
	return runGit(cwd, ["status", "--porcelain"]).length > 0;
}

function readHeadCommitHash(cwd: string): string {
	return runGit(cwd, ["rev-parse", "HEAD"]);
}

function buildFallbackCommitMessage(task: WorkflowTask): string {
	return `feat(workflows): ${task.summary}`;
}

function recordTaskCommit(taskState: TaskState, taskId: string, commitHash: string): void {
	applyTaskCommit(taskState, {
		taskId,
		commitHash,
		status: "committed",
	});
}

export function applyReviewCommit(input: ReviewCommitInput): ReviewCommitResult {
	const task = input.taskState.tasks.find((item) => item.id === input.taskId);
	if (!task) throw new Error(`Unknown task: ${input.taskId}`);

	if (input.commitHash) {
		recordTaskCommit(input.taskState, input.taskId, input.commitHash);
		return {
			commitHash: input.commitHash,
			committed: false,
			skipped: false,
		};
	}

	const hasReviewCommitSignal =
		input.commitIntent !== undefined || input.commitMessage?.trim() !== undefined;
	if (!hasUncommittedChanges(input.cwd)) {
		if (hasReviewCommitSignal) {
			const headCommitHash = readHeadCommitHash(input.cwd);
			recordTaskCommit(input.taskState, input.taskId, headCommitHash);
			return {
				commitHash: headCommitHash,
				committed: false,
				skipped: false,
			};
		}

		return {
			committed: false,
			skipped: true,
		};
	}

	if (input.commitIntent === "existing") {
		return {
			committed: false,
			skipped: true,
		};
	}

	const commitMessage = input.commitMessage?.trim() || buildFallbackCommitMessage(task);
	runGit(input.cwd, ["add", "-A"]);
	runGit(input.cwd, ["commit", "-m", commitMessage]);
	const commitHash = readHeadCommitHash(input.cwd);
	recordTaskCommit(input.taskState, input.taskId, commitHash);

	return {
		commitHash,
		committed: true,
		skipped: false,
	};
}
