import type { WorkflowRuntime } from "../state/workflow-state.ts";
import { getAlignmentInstructions } from "./alignment-instructions.ts";
import { getAutonomousInstructions } from "./autonomous-instructions.ts";
import { getBaseInstructions } from "./base-instructions.ts";
import { getSuperpowersInstructions } from "./superpowers-instructions.ts";

export function buildWorkflowPrompt(runtime: WorkflowRuntime): string {
	switch (runtime.activeWorkflow) {
		case "base":
			return getBaseInstructions(runtime);
		case "superpowers":
			return getSuperpowersInstructions(runtime);
		case "alignment":
			return getAlignmentInstructions(runtime);
		case "autonomous":
			return getAutonomousInstructions(runtime);
	}
}
