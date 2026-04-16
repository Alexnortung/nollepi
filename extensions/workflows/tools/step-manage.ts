import { TaskState } from "../state/task-state.ts";

export function applyStepAction(state: TaskState, input: any): TaskState {
	switch (input.action) {
		case "create": {
			const step = state.addStep({
				taskId: input.taskId,
				summary: input.summary,
				description: input.description,
				hasArtifact: input.hasArtifact ?? false,
				artifactPath: input.artifactPath,
			});
			state.currentTaskId = input.taskId;
			state.currentStepId = step.id;
			return state;
		}
		case "update":
			state.updateStep(input.taskId, input.stepId, {
				summary: input.summary,
				description: input.description,
				status: input.status,
				hasArtifact: input.hasArtifact,
				artifactPath: input.artifactPath,
			});
			state.currentTaskId = input.taskId;
			state.currentStepId = input.stepId;
			return state;
		case "complete":
			state.completeStep(input.taskId, input.stepId);
			state.currentTaskId = input.taskId;
			state.currentStepId = input.stepId;
			return state;
		default:
			throw new Error(`Unknown action: ${input.action}`);
	}
}
