import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function workflowExtension(pi: ExtensionAPI): void {
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.notify("Workflow extension loaded", "info");
	});
}
