import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { TaskState } from "../state/task-state.ts";
import { applyTaskCommit } from "./task-commit.ts";

export const taskCommitSchema = Type.Object({
	taskId: Type.String(),
	commitHash: Type.String(),
	status: Type.Optional(Type.String()),
});

export function registerTaskCommitTool(
	pi: ExtensionAPI,
	getTaskState: () => TaskState,
	onChange: () => void,
): void {
	pi.registerTool({
		name: "task_commit",
		label: "Task Commit",
		description: "Record commit hashes on workflow tasks.",
		promptSnippet: "Record commit hashes against current workflow task",
		parameters: taskCommitSchema,
		async execute(_toolCallId, params) {
			const state = getTaskState();
			applyTaskCommit(state, params);
			onChange();
			const task = state.tasks.find((item) => item.id === params.taskId);
			return {
				content: [
					{
						type: "text",
						text:
							`Recorded commit ${params.commitHash} on task ${params.taskId}. ` +
							`Task now has commits: ${task?.commitHashes.join(", ") ?? params.commitHash}`,
					},
				],
				details: {
					taskId: params.taskId,
					commitHash: params.commitHash,
					commitHashes: task?.commitHashes ?? [params.commitHash],
				},
			};
		},
	});
}
