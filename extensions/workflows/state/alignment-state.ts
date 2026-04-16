export type PartState = "unaligned" | "under-discussion" | "aligned" | "skipped" | "not-relevant";
export type CategoryRelevance = "relevant" | "not-relevant";

export interface AlignmentPart {
	id: string;
	summary: string;
	details: string;
	state: PartState;
}

export interface AlignmentCategory {
	name: string;
	relevance: CategoryRelevance;
	parts: AlignmentPart[];
}

export interface AlignmentSnapshot {
	categories: AlignmentCategory[];
	nextPartId: number;
}

const DEFAULT_CATEGORIES: string[] = [
	"objective",
	"scope",
	"constraints",
	"risks",
	"domain-language",
	"approach",
	"open-questions",
];

export class AlignmentState {
	categories: AlignmentCategory[];
	private nextPartId: number;

	constructor(snapshot?: AlignmentSnapshot) {
		if (snapshot) {
			this.categories = structuredClone(snapshot.categories);
			this.nextPartId = snapshot.nextPartId;
		} else {
			this.categories = DEFAULT_CATEGORIES.map((name) => ({
				name,
				relevance: "relevant" as CategoryRelevance,
				parts: [],
			}));
			this.nextPartId = 1;
		}
	}

	private findCategory(name: string): AlignmentCategory {
		const cat = this.categories.find((c) => c.name === name);
		if (!cat) throw new Error(`Unknown category: ${name}`);
		return cat;
	}

	private findPart(categoryName: string, partId: string): AlignmentPart {
		const cat = this.findCategory(categoryName);
		const part = cat.parts.find((p) => p.id === partId);
		if (!part) throw new Error(`Unknown part: ${partId} in ${categoryName}`);
		return part;
	}

	addPart(categoryName: string, input: { summary: string; details: string }): AlignmentPart {
		const cat = this.findCategory(categoryName);
		const part: AlignmentPart = {
			id: `part-${this.nextPartId++}`,
			summary: input.summary,
			details: input.details,
			state: "unaligned",
		};
		cat.parts.push(part);
		return part;
	}

	updatePart(categoryName: string, partId: string, patch: { summary?: string; details?: string }): void {
		const part = this.findPart(categoryName, partId);
		if (patch.summary !== undefined) part.summary = patch.summary;
		if (patch.details !== undefined) part.details = patch.details;
	}

	confirmPart(categoryName: string, partId: string): void {
		this.findPart(categoryName, partId).state = "aligned";
	}

	skipPart(categoryName: string, partId: string): void {
		this.findPart(categoryName, partId).state = "skipped";
	}

	reopenPart(categoryName: string, partId: string): void {
		this.findPart(categoryName, partId).state = "under-discussion";
	}

	setCategoryRelevance(categoryName: string, relevance: CategoryRelevance): void {
		this.findCategory(categoryName).relevance = relevance;
	}

	getSummary(): { aligned: number; pending: number; skipped: number; total: number } {
		let aligned = 0;
		let pending = 0;
		let skipped = 0;
		for (const cat of this.categories) {
			if (cat.relevance === "not-relevant") continue;
			for (const part of cat.parts) {
				if (part.state === "aligned") aligned++;
				else if (part.state === "skipped" || part.state === "not-relevant") skipped++;
				else pending++;
			}
		}
		return { aligned, pending, skipped, total: aligned + pending + skipped };
	}

	serialize(): AlignmentSnapshot {
		return {
			categories: structuredClone(this.categories),
			nextPartId: this.nextPartId,
		};
	}

	static restore(snapshot?: AlignmentSnapshot): AlignmentState {
		return new AlignmentState(snapshot);
	}
}
