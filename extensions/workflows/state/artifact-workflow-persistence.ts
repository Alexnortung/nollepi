import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
	PersistedWorkflowState,
	WorkflowPersistenceBackend,
	WorkflowPersistenceLoadResult,
	WorkflowPersistenceRevision,
	WorkflowPersistenceSaveInput,
	WorkflowPersistenceSaveResult,
} from "./workflow-persistence.ts";

const STATE_FILE_RELATIVE_PATH = "docs/.workflows/persisted-state.json";

interface StoredData {
	revision: WorkflowPersistenceRevision;
	state: PersistedWorkflowState;
}

/**
 * Workflow persistence backend that stores state as a JSON file alongside the
 * workflow artifact directory. Workflow, task, and step markdown artifacts
 * continue to be written by the extension's syncArtifacts flow and remain the
 * human-readable record. This class owns only the durable structured state.
 */
export class ArtifactWorkflowPersistenceBackend implements WorkflowPersistenceBackend {
	private readonly stateFilePath: string;

	constructor(baseDir: string) {
		this.stateFilePath = path.join(baseDir, STATE_FILE_RELATIVE_PATH);
	}

	async load(): Promise<WorkflowPersistenceLoadResult | undefined> {
		let raw: string;
		try {
			raw = await fs.readFile(this.stateFilePath, "utf8");
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
			throw error;
		}
		const stored: StoredData = JSON.parse(raw);
		return { revision: stored.revision, state: stored.state };
	}

	async save(input: WorkflowPersistenceSaveInput): Promise<WorkflowPersistenceSaveResult> {
		const current = await this.load();
		const currentRevision = current?.revision;
		if (currentRevision !== input.expectedRevision) {
			if (currentRevision !== undefined || input.expectedRevision !== undefined) {
				return { ok: false, reason: "stale", currentRevision };
			}
		}

		const revision = crypto.randomUUID();
		const stored: StoredData = { revision, state: input.state };
		await fs.mkdir(path.dirname(this.stateFilePath), { recursive: true });
		await fs.writeFile(this.stateFilePath, JSON.stringify(stored, null, 2), "utf8");
		return { ok: true, revision };
	}

	async isStale(revision: WorkflowPersistenceRevision | undefined): Promise<boolean> {
		const current = await this.load();
		return current?.revision !== revision;
	}
}
