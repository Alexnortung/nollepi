import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { SubagentDispatchPacket, SubagentResult, WorkflowSubagentRun } from "./contracts.ts";
import { buildSubagentSystemPrompt, buildSubagentUserPrompt } from "./prompts.ts";
import { parseSubagentResult } from "./result-parser.ts";

export interface SubagentSpawnCallbacks {
	onText(delta: string): void;
	onToolCall(): void;
	onFinish(result: SubagentResult, rawText: string): void;
	onError(message: string): void;
}

function toolsForRole(role: SubagentDispatchPacket["role"]): string[] {
	switch (role) {
		case "investigator":
			return ["read", "bash", "grep", "find", "ls"];
		case "builder":
			return ["read", "bash", "edit", "write", "grep", "find", "ls"];
		case "reviewer":
			return ["read", "bash", "grep", "find", "ls"];
	}
}

function readAssistantText(message: unknown): string {
	if (!message || typeof message !== "object") return "";
	const record = message as { role?: string; content?: Array<{ type?: string; text?: string }> };
	if (record.role !== "assistant" || !Array.isArray(record.content)) return "";
	return record.content.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n");
}

export function spawnSubagentProcess(
	_pi: ExtensionAPI,
	cwd: string,
	_run: WorkflowSubagentRun,
	packet: SubagentDispatchPacket,
	callbacks: SubagentSpawnCallbacks,
): ChildProcessWithoutNullStreams {
	const tempDir = mkdtempSync(path.join(os.tmpdir(), "workflow-subagent-"));
	const promptPath = path.join(tempDir, "system-prompt.txt");
	writeFileSync(promptPath, buildSubagentSystemPrompt(packet), "utf8");

	const child = spawn("pi", [
		"--mode",
		"json",
		"-p",
		"--no-session",
		"--append-system-prompt",
		promptPath,
		"--tools",
		toolsForRole(packet.role).join(","),
		buildSubagentUserPrompt(packet),
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
				if (event.type === "tool_execution_start") {
					callbacks.onToolCall();
				}
			} catch {
				// ignore malformed event lines
			}
		}
	});

	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk: string) => callbacks.onText(chunk));
	child.on("close", () => {
		try {
			callbacks.onFinish(parseSubagentResult(assistantText), assistantText);
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
