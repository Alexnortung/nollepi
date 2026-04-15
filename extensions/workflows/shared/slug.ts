function slugify(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

export function buildWorkflowRunSlug(input: {
	date: string;
	index: number;
	workflow: string;
	title: string;
}) {
	return `${input.date}-${String(input.index).padStart(2, "0")}-${slugify(input.workflow)}-${slugify(input.title)}`;
}
