import type { TaskOrchestratorSession } from "../state/task-orchestrator-state.ts";

export function shouldRouteSpecialistResultToTaskOrchestrator(
	session: TaskOrchestratorSession | undefined,
	taskId?: string,
): boolean {
	if (!session || !taskId) return false;
	if (session.status === "closed") return false;
	return session.taskId === taskId;
}
