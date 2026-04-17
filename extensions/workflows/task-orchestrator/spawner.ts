import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { TaskOrchestratorSession } from "../state/task-orchestrator-state.ts";
import type { TaskOrchestratorPacket } from "./packet-builder.ts";
import { buildTaskOrchestratorSystemPrompt, buildTaskOrchestratorUserPrompt } from "./prompts.ts";
import { parseTaskOrchestratorResult } from "./result-parser.ts";

export interface TaskOrchestratorSpawnCallbacks {
	onText(delta: string): void;
	onToolCall(): void;
	onFinish(result: ReturnType<typeof parseTaskOrchestratorResult>["result"], displayText: string, rawText: string): void;
	onError(message: string): void;
}

export function createTaskOrchestratorSessionFile(taskId: string): string {
	const dir = path.join(os.homedir(), ".pi", "agent", "sessions", "workflow-task-orchestrator");
	mkdirSync(dir, { recursive: true });
	return path.join(dir, `${taskId}-${Date.now()}.jsonl`);
}

function readAssistantText(message: unknown): string {
	if (!message || typeof message !== "object") return "";
	const record = message as { role?: string; content?: Array<{ type?: string; text?: string }> };
	if (record.role !== "assistant" || !Array.isArray(record.content)) return "";
	return record.content.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n");
}

export function spawnTaskOrchestratorTurn(
	_pi: ExtensionAPI,
	cwd: string,
	session: TaskOrchestratorSession,
	packet: TaskOrchestratorPacket,
	userMessage: string,
	callbacks: TaskOrchestratorSpawnCallbacks,
): ChildProcessWithoutNullStreams {
	const tempDir = mkdtempSync(path.join(os.tmpdir(), "workflow-task-orchestrator-"));
	const promptPath = path.join(tempDir, "system-prompt.txt");
	writeFileSync(promptPath, buildTaskOrchestratorSystemPrompt(packet), "utf8");

	const child = spawn("pi", [
		"--mode",
		"json",
		"-p",
		"--session",
		session.sessionFile,
		"--no-extensions",
		"--append-system-prompt",
		promptPath,
		"--tools",
		"read,bash,grep,find,ls",
		buildTaskOrchestratorUserPrompt(packet, userMessage),
	], { cwd, stdio: ["ignore", "pipe", "pipe"] });

	let buffer = "";
	let assistantText = "";

	child.stdout.setEncoding("utf8");
	child.stdout.on("data", (chunk: string) => {
		buffer += chunk;
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			if (!line.trim()) continue;
			try {
				const event = JSON.parse(line) as {
					type?: string;
					assistantMessageEvent?: { type?: string; delta?: string };
					message?: unknown;
				};
				if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
					const delta = event.assistantMessageEvent.delta ?? "";
					assistantText += delta;
					callbacks.onText(delta);
				}
				if (event.type === "message_end") {
					const full = readAssistantText(event.message);
					if (assistantText.length === 0 && full.length > 0) {
						assistantText = full;
						callbacks.onText(full);
					}
				}
				if (event.type === "tool_execution_start") callbacks.onToolCall();
			} catch {
				// ignore malformed event lines
			}
		}
	});

	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk: string) => callbacks.onText(chunk));
	child.on("close", () => {
		try {
			const parsed = parseTaskOrchestratorResult(assistantText);
			callbacks.onFinish(parsed.result, parsed.displayText, assistantText);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			callbacks.onError(message);
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});
	child.on("error", (error) => {
		callbacks.onError(error.message);
		rmSync(tempDir, { recursive: true, force: true });
	});
	return child;
}
