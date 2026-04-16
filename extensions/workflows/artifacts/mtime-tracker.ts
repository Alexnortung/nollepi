import * as fs from "node:fs/promises";

export class MtimeTracker {
	private mtimes = new Map<string, number>();

	async recordMtime(filePath: string): Promise<void> {
		try {
			const stat = await fs.stat(filePath);
			this.mtimes.set(filePath, stat.mtimeMs);
		} catch {
			// ignore missing files
		}
	}

	async recordMtimes(filePaths: string[]): Promise<void> {
		for (const filePath of filePaths) {
			await this.recordMtime(filePath);
		}
	}

	async checkForChanges(): Promise<string[]> {
		const changed: string[] = [];

		for (const [filePath, lastMtime] of this.mtimes) {
			try {
				const stat = await fs.stat(filePath);
				if (stat.mtimeMs > lastMtime) {
					changed.push(filePath);
					this.mtimes.set(filePath, stat.mtimeMs);
				}
			} catch {
				changed.push(filePath);
				this.mtimes.delete(filePath);
			}
		}

		return changed;
	}

	toMap(): Map<string, number> {
		return new Map(this.mtimes);
	}

	restoreFromMap(map: Map<string, number>): void {
		this.mtimes = new Map(map);
	}

	clear(): void {
		this.mtimes.clear();
	}
}
