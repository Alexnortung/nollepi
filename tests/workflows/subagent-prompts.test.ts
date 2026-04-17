import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	buildSubagentSystemPrompt,
	buildSubagentUserPrompt,
} from "../../extensions/workflows/subagents/prompts.ts";
import type { BuilderPacket, ReviewerPacket } from "../../extensions/workflows/subagents/contracts.ts";

const packet: BuilderPacket = {
	role: "builder",
	workflow: "alignment",
	workflowState: "task-execution",
	runId: "2026-04-17-01-test",
	task: {
		id: "01-fix-result-json",
		summary: "Fix RESULT_JSON handling",
		description: "Make subagent parsing reliable.",
		status: "in-progress",
	},
	goal: "Fix RESULT_JSON handling.",
	hardConstraints: [],
	priorFindings: [],
	successTarget: "Return structured output.",
	alignedContext: {
		objective: [],
		scope: [],
		constraints: [],
		approach: [],
		domainLanguage: [],
	},
	doneCriteria: [],
};

describe("buildSubagentUserPrompt", () => {
	it("requires a canonical final RESULT_JSON format", () => {
		const prompt = buildSubagentUserPrompt(packet);
		assert.match(prompt, /RESULT_JSON:/);
		assert.match(prompt, /Do not wrap the JSON in markdown fences/i);
		assert.match(prompt, /Do not add any text after the RESULT_JSON payload/i);
	});

	it("shows a concrete reviewer RESULT_JSON example", () => {
		const reviewerPacket: ReviewerPacket = {
			...packet,
			role: "reviewer",
			alignedContext: {
				objective: [],
				scope: [],
				constraints: [],
				approach: [],
			},
			changedFiles: [],
			commits: [],
			verification: [],
		};
		const prompt = buildSubagentUserPrompt(reviewerPacket);
		assert.match(
			prompt,
			/RESULT_JSON:\n\{"role":"reviewer","verdict":"pass","issues":\[\],"verificationGaps":\[\],"suggestedNextAction":"Ship it"\}/,
		);
	});
});

describe("buildSubagentSystemPrompt", () => {
	it("uses canonical RESULT_JSON wording for builder prompts", () => {
		const prompt = buildSubagentSystemPrompt(packet);
		assert.match(prompt, /RESULT_JSON:/);
		assert.match(prompt, /Do not wrap the JSON in markdown fences/i);
		assert.match(prompt, /Do not add any text after the RESULT_JSON payload/i);
	});

	it("uses canonical RESULT_JSON wording for reviewer prompts", () => {
		const reviewerPacket: ReviewerPacket = {
			...packet,
			role: "reviewer",
			alignedContext: {
				objective: [],
				scope: [],
				constraints: [],
				approach: [],
			},
			changedFiles: [],
			commits: [],
			verification: [],
		};
		const prompt = buildSubagentSystemPrompt(reviewerPacket);
		assert.match(prompt, /RESULT_JSON:/);
		assert.match(prompt, /Do not wrap the JSON in markdown fences/i);
		assert.match(prompt, /Do not add any text after the RESULT_JSON payload/i);
	});

	it("shows a concrete reviewer RESULT_JSON example", () => {
		const reviewerPacket: ReviewerPacket = {
			...packet,
			role: "reviewer",
			alignedContext: {
				objective: [],
				scope: [],
				constraints: [],
				approach: [],
			},
			changedFiles: [],
			commits: [],
			verification: [],
		};
		const prompt = buildSubagentSystemPrompt(reviewerPacket);
		assert.match(
			prompt,
			/RESULT_JSON:\n\{"role":"reviewer","verdict":"pass","issues":\[\],"verificationGaps":\[\],"suggestedNextAction":"Ship it"\}/,
		);
	});
});
