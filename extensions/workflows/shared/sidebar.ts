export function renderWorkflowWidget(input: {
	workflow: string;
	state: string;
	currentTask?: string;
	currentStep?: string;
	pendingApproval?: string;
}) {
	const lines = [`Workflow: ${input.workflow}`, `State: ${input.state}`];
	if (input.currentTask) lines.push(`Task: ${input.currentTask}`);
	if (input.currentStep) lines.push(`Step: ${input.currentStep}`);
	if (input.pendingApproval) lines.push(`Needs approval: ${input.pendingApproval}`);
	return lines;
}
